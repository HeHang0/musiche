import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { useTitle } from '@vueuse/core';
import * as musicAPI from '../utils/api/api';
import { useSettingStore } from './setting';
import type { Music } from '../utils/type';
import {
  createRoomIdentity,
  hasRoomServerAddressConfigured,
  roomRequest,
  type RoomChatMessage,
  type RoomIdentity,
  type RoomServiceConfig,
  type RoomSnapshot,
  type RoomSummary
} from '../utils/room';
import { RoomRealtimeTransport } from '../utils/room-transport';
import {
  decryptRoomChatPayload,
  encryptRoomChatPayload,
  normalizeRoomChatKey,
  rememberedRoomChatKey,
  rememberRoomChatKey
} from '../utils/room-chat-crypto';

export const currentRoomKey = 'musiche-room-current-id';
const adminTokensKey = 'musiche-room-admin-tokens';
const roomVolumeKey = 'musiche-room-volume';
const title = useTitle();
let chatReceiveQueue = Promise.resolve();

function readAdminTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(adminTokensKey) || '{}');
  } catch {
    return {};
  }
}

function writeAdminTokens(tokens: Record<string, string>) {
  if (Object.keys(tokens).length === 0) localStorage.removeItem(adminTokensKey);
  else localStorage.setItem(adminTokensKey, JSON.stringify(tokens));
}

function deleteAdminToken(roomId: string) {
  const tokens = readAdminTokens();
  if (!(roomId in tokens)) return;
  delete tokens[roomId];
  writeAdminTokens(tokens);
}

export const useRoomStore = defineStore('room', {
  state: () => ({
    initialized: false,
    loading: false,
    serviceAvailable: false,
    serviceChecking: false,
    connected: false,
    reconnectTimer: null as ReturnType<typeof setTimeout> | null,
    transport: null as RoomRealtimeTransport | null,
    transportFailureCode: '',
    identity: createRoomIdentity() as RoomIdentity,
    memberToken: '',
    config: null as RoomServiceConfig | null,
    snapshot: null as RoomSnapshot | null,
    lastError: '',
    volume: Number(localStorage.getItem(roomVolumeKey) || 80),
    audio: null as HTMLAudioElement | null,
    localPlaying: false,
    audioNeedsGesture: false,
    pendingSeekSeconds: null as number | null,
    loadedMusicKey: '',
    loadedQueueId: '',
    audioResolveAbort: null as AbortController | null,
    audioResolveTimer: null as ReturnType<typeof setTimeout> | null,
    audioRetryTimer: null as ReturnType<typeof setTimeout> | null,
    adminCookieSyncing: false,
    syncingAudio: false,
    audioSyncPending: false,
    chatKey: '',
    chatKeyRoomId: '',
    chatMessages: [] as RoomChatMessage[]
  }),
  getters: {
    room: state => state.snapshot?.room || null,
    isAdmin: state => Boolean(state.snapshot?.isAdmin),
    hasChatKey: state =>
      Boolean(
        state.chatKey &&
          state.snapshot?.room.id.toUpperCase() === state.chatKeyRoomId
      ),
    adminToken(state) {
      const id = state.snapshot?.room.id;
      return id ? readAdminTokens()[id] || '' : '';
    },
    currentPosition:
      state =>
      (now = Date.now()) => {
        const playback = state.snapshot?.state.playback;
        if (!playback) return 0;
        const base = playback.positionMs || 0;
        return playback.playing
          ? base + Math.max(0, now - new Date(playback.updatedAt).getTime())
          : base;
      }
  },
  actions: {
    async checkAvailability() {
      console.log('[在线歌房] 检查服务可用性');
      if (!hasRoomServerAddressConfigured()) {
        this.serviceAvailable = false;
        this.config = null;
        return false;
      }
      this.serviceChecking = true;
      try {
        this.config = await roomRequest<RoomServiceConfig>('/api/v1/config');
        this.serviceAvailable = true;
        return true;
      } catch {
        this.serviceAvailable = false;
        return false;
      } finally {
        this.serviceChecking = false;
      }
    },
    async initialize() {
      if (this.initialized) return;
      this.initialized = true;
      title.value = '在线歌房 - Musiche';
      this.loading = true;
      try {
        if (!(await this.checkAvailability())) return;
      } catch (error: any) {
        this.initialized = false;
        this.lastError = error?.message || '无法连接歌房服务';
      } finally {
        this.loading = false;
      }
    },
    async list(keyword = '', page = 1, pageSize?: number) {
      const size = pageSize || this.config?.listPageSize || 24;
      const query = new URLSearchParams({
        keyword,
        page: page.toString(),
        pageSize: size.toString()
      });
      return roomRequest<{
        items: RoomSummary[];
        total: number;
        page: number;
        pageSize: number;
      }>('/api/v1/rooms?' + query);
    },
    async missingRoomIds(roomIds: string[]) {
      if (roomIds.length === 0) return [];
      const response = await roomRequest<{ missingIds: string[] }>(
        '/api/v1/rooms/missing',
        {
          method: 'POST',
          body: JSON.stringify({ ids: roomIds })
        }
      );
      return response.missingIds;
    },
    async create(payload: {
      name: string;
      entryPassword: string;
      adminPassword: string;
      nickname: string;
      chatEncrypted: boolean;
      chatKey?: string;
    }) {
      if (payload.chatEncrypted && !this.config?.chatEncryptionSupported)
        throw new Error('当前歌房服务版本不支持端到端加密，请更新并重启服务');
      const { chatKey = '', ...request } = payload;
      const response = await roomRequest<{
        snapshot: RoomSnapshot;
        adminToken: string;
        memberToken: string;
      }>('/api/v1/rooms', {
        method: 'POST',
        body: JSON.stringify({ ...request, ...this.identity })
      });
      this.memberToken = response.memberToken;
      this.saveAdminToken(response.snapshot.room.id, response.adminToken);
      this.setRoomChatKey(response.snapshot.room.id, chatKey);
      this.setSnapshot(response.snapshot);
      this.connect();
    },
    async join(
      roomId: string,
      payload: { nickname: string; entryPassword: string }
    ) {
      if (this.chatKeyRoomId !== roomId.toUpperCase())
        this.setRoomChatKey(roomId, rememberedRoomChatKey(roomId));
      const token = readAdminTokens()[roomId] || '';
      const response = await roomRequest<{
        snapshot: RoomSnapshot;
        memberToken: string;
      }>(`/api/v1/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          ...this.identity,
          adminToken: token
        })
      });
      if (token && !response.snapshot.isAdmin) deleteAdminToken(roomId);
      this.memberToken = response.memberToken;
      this.setSnapshot(response.snapshot);
      this.connect();
    },
    async open(roomId: string, connect = true) {
      if (this.chatKeyRoomId !== roomId.toUpperCase())
        this.setRoomChatKey(roomId, rememberedRoomChatKey(roomId));
      const token = readAdminTokens()[roomId] || '';
      const query = new URLSearchParams({
        visitorId: this.identity.visitorId,
        fingerprint: this.identity.fingerprint,
        adminToken: token
      });
      const response = await roomRequest<{
        snapshot: RoomSnapshot;
        memberToken: string;
      }>(`/api/v1/rooms/${encodeURIComponent(roomId)}?${query}`);
      // A cached token may have been issued for an older administrator
      // password or token format. The HTTP snapshot is authoritative, so
      // discard an invalid token before opening the realtime connection.
      if (token && !response.snapshot.isAdmin) deleteAdminToken(roomId);
      this.memberToken = response.memberToken;
      this.setSnapshot(response.snapshot);
      if (connect) this.connect();
    },
    setSnapshot(snapshot: RoomSnapshot) {
      const previous = this.snapshot;
      const previousQueueId = previous?.state.current?.id || '';
      const nextQueueId = snapshot.state.current?.id || '';
      // Do not let the old source continue while the new track is resolving.
      // This also invalidates an in-flight result for a previous queue item.
      if (previous && previousQueueId !== nextQueueId) this.resetLoadedAudio();
      if (previous && previous.room.id !== snapshot.room.id)
        this.chatMessages = [];
      this.snapshot = snapshot;
      this.lastError = '';
      localStorage.setItem(currentRoomKey, snapshot.room.id);
      if (snapshot.isAdmin) void this.syncAdminCookies();
      this.scheduleAudioSync();
    },
    setRoomChatKey(roomId: string, key: string) {
      const normalizedRoomId = roomId.trim().toUpperCase();
      const normalizedKey = normalizeRoomChatKey(key);
      this.chatKeyRoomId = normalizedRoomId;
      this.chatKey = normalizedKey;
      if (normalizedKey) rememberRoomChatKey(normalizedRoomId, normalizedKey);
      return Boolean(normalizedKey);
    },
    connect() {
      if (!this.snapshot) return;
      this.stopReconnect();
      this.transport?.close();
      this.transport = null;
      this.connected = false;
      this.transportFailureCode = '';
      let rejectionCode = '';
      const transport = new RoomRealtimeTransport(
        this.snapshot.room.id,
        this.memberToken,
        {
          onConnecting: () => {
            if (this.transport !== transport) return;
            this.connected = false;
          },
          onOpen: () => {
            if (this.transport !== transport) return;
            this.connected = true;
            this.transportFailureCode = '';
            // Establish administrator privileges after the realtime channel
            // is ready. A guest can still become an administrator later.
            const adminToken = this.adminToken;
            if (adminToken)
              transport.send({
                type: 'command',
                action: 'auth_admin',
                adminToken
              });
          },
          onMessage: raw => {
            if (this.transport !== transport) return;
            const code = this.handleEvent(raw);
            if (code) rejectionCode = code;
          },
          onError: event => {
            if (this.transport !== transport) return;
            this.transportFailureCode = event.code;
            this.lastError = event.message;
            console.error('[在线歌房] 实时连接错误', event);
          },
          onClose: event => {
            // Closing an older channel while credentials change must not mark
            // the replacement channel as disconnected.
            if (this.transport !== transport) return;
            this.connected = false;
            const code = rejectionCode || event.code;
            this.transportFailureCode = code;
            const roomId = this.snapshot?.room.id;
            if (
              roomId &&
              (code === 'missing_member_token' ||
                code === 'invalid_member_token')
            ) {
              this.memberToken = '';
              this.reconnectTimer = setTimeout(() => {
                if (this.snapshot?.room.id !== roomId) return;
                void this.open(roomId).catch((error: any) => {
                  this.lastError = error?.message || '刷新歌房连接凭证失败';
                });
              }, 300);
            } else if (
              this.snapshot &&
              ![
                'missing_room_id',
                'room_not_found',
                'member_connect_failed',
                'invalid_message'
              ].includes(code)
            ) {
              const delay = ['room_full', 'connection_limit_reached'].includes(
                code
              )
                ? 10000
                : 2000;
              this.reconnectTimer = setTimeout(() => this.connect(), delay);
            }
          }
        }
      );
      this.transport = markRaw(transport);
      transport.start();
    },
    stopReconnect() {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    },
    handleEvent(raw: string) {
      try {
        const event = JSON.parse(raw);
        if (event.type === 'snapshot')
          this.setSnapshot(event.data as RoomSnapshot);
        else if (event.type === 'presence' && this.snapshot) {
          this.snapshot.room = event.data;
        } else if (event.type === 'chat' && this.snapshot) {
          const chat = event.data as RoomChatMessage;
          if (!this.chatMessages.some(item => item.id === chat.id)) {
            if (chat.encrypted) {
              chatReceiveQueue = chatReceiveQueue
                .then(() => this.receiveEncryptedChatMessage(chat))
                .catch(() => {});
            } else this.chatMessages.push(chat);
          }
        } else if (event.type === 'audio_ready' && this.snapshot) {
          const active = this.snapshot.state.current;
          if (
            active &&
            String(active.music.id) === String(event.data?.id) &&
            active.music.type === event.data?.type
          ) {
            // A privileged member has just shared a five-minute resolved URL.
            // If a local resolution is still running, wait for it to unwind
            // before retrying instead of losing this notification.
            this.scheduleAudioSync(100);
          }
        } else if (event.type === 'dissolved') {
          this.lastError = event.data || '房间已解散';
          this.leave(false);
        } else if (event.type === 'error') {
          const message =
            typeof event.data === 'string'
              ? event.data
              : event.data?.message || '歌房操作失败';
          const code = String(event.code || event.data?.code || '');
          if (message === '管理员凭证无效' && this.snapshot) {
            deleteAdminToken(this.snapshot.room.id);
          }
          this.lastError = message;
          if (
            [
              'missing_room_id',
              'missing_member_token',
              'room_not_found',
              'connection_limit_reached',
              'invalid_member_token',
              'member_connect_failed',
              'room_full',
              'invalid_message',
              'connection_id_conflict',
              'realtime_connection_not_found',
              'invalid_connection_id',
              'invalid_connection',
              'streaming_unsupported'
            ].includes(code)
          ) {
            this.transportFailureCode = code;
            console.error('[在线歌房] 实时服务端拒绝连接', {
              code,
              message
            });
            return code;
          }
        }
      } catch {
        this.lastError = '歌房消息解析失败';
      }
      return '';
    },
    async receiveEncryptedChatMessage(chat: RoomChatMessage) {
      const roomId = this.snapshot?.room.id;
      if (!roomId || !chat.encrypted) return;
      const appendMessage = (changes: Partial<RoomChatMessage>) => {
        if (
          this.snapshot?.room.id !== roomId ||
          this.chatMessages.some(item => item.id === chat.id)
        )
          return;
        this.chatMessages.push({ ...chat, ...changes });
      };
      if (!this.hasChatKey) {
        appendMessage({
          content: '🔒 需要包含聊天密钥的邀请链接才能查看此消息',
          image: '',
          decryptionFailed: true
        });
        return;
      }
      try {
        const payload = await decryptRoomChatPayload(
          roomId,
          this.chatKey,
          chat.encrypted
        );
        appendMessage({
          content: payload.content,
          image: payload.image,
          decryptionFailed: false
        });
      } catch {
        appendMessage({
          content: '🔒 消息解密失败，邀请链接中的密钥可能不正确',
          image: '',
          decryptionFailed: true
        });
      }
    },
    command(action: string, data: Record<string, any> = {}) {
      if (!this.transport?.isOpen()) {
        this.lastError = '正在连接歌房服务';
        return false;
      }
      if (
        !this.transport.send({
          type: 'command',
          action,
          adminToken: this.adminToken,
          ...data
        })
      )
        this.lastError = '歌房实时消息发送失败';
      else return true;
      return false;
    },
    addQueue(music: Music) {
      this.command('queue_add', { music: { ...music, url: '', lyricUrl: '' } });
    },
    removeQueue(queueId: string) {
      this.command('queue_remove', { queueId });
    },
    togglePinQueue(queueId: string) {
      this.command('queue_pin', { queueId });
    },
    togglePlay() {
      this.command('play_toggle');
    },
    togglePlayerAction() {
      if (this.snapshot?.state.playback.playing && !this.localPlaying) {
        void this.resumeAudio().catch(error => {
          this.lastError = error?.message || '恢复本地播放失败';
        });
        return;
      }
      this.togglePlay();
    },
    next() {
      this.command('next');
    },
    toggleRandomPlayback() {
      this.command('random_playback_toggle');
    },
    seek(positionMs: number) {
      console.log('[在线歌房] seek', positionMs);
      this.command('seek', { positionMs: Math.round(positionMs) });
    },
    async chat(content: string, image = '', avatar = '') {
      const room = this.snapshot?.room;
      if (!room) return false;
      if (!room.chatEncrypted)
        return this.command('chat', { content, image, avatar });
      if (!this.hasChatKey) {
        this.lastError = '当前歌房聊天已端到端加密，请使用完整邀请链接进入';
        return false;
      }
      try {
        const encrypted = await encryptRoomChatPayload(
          room.id,
          this.chatKey,
          { content, image }
        );
        return this.command('chat', { encrypted, avatar });
      } catch (error: any) {
        this.lastError = error?.message || '聊天消息加密失败';
        return false;
      }
    },
    pat(memberId: string) {
      if (!this.snapshot || memberId === this.snapshot.memberId) return;
      this.command('pat', { memberId });
    },
    async becomeAdmin(password: string) {
      if (!this.snapshot) return;
      const roomId = this.snapshot.room.id;
      const response = await roomRequest<{ adminToken: string }>(
        `/api/v1/rooms/${roomId}/admin`,
        {
          method: 'POST',
          body: JSON.stringify({ adminPassword: password, ...this.identity })
        }
      );
      this.saveAdminToken(roomId, response.adminToken);
      if (this.transport?.isOpen()) {
        this.transport.send({
          type: 'command',
          action: 'auth_admin',
          adminToken: response.adminToken
        });
      } else {
        await this.open(roomId);
      }
    },
    async updateNickname(nickname: string) {
      if (!this.snapshot || !this.memberToken) return;
      const response = await roomRequest<{ snapshot: RoomSnapshot }>(
        `/api/v1/rooms/${this.snapshot.room.id}/nickname`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${this.memberToken}` },
          body: JSON.stringify({
            nickname,
            ...this.identity,
            adminToken: this.adminToken
          })
        }
      );
      this.setSnapshot(response.snapshot);
    },
    async updateSettings(payload: {
      name?: string;
      entryPassword?: string;
      adminPassword?: string;
      allowGuestQueue?: boolean;
    }) {
      if (!this.snapshot) return;
      const response = await roomRequest<{
        snapshot: RoomSnapshot;
        adminToken: string;
        memberToken: string;
      }>(`/api/v1/rooms/${this.snapshot.room.id}/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          ...payload,
          ...this.identity,
          adminToken: this.adminToken
        })
      });
      this.memberToken = response.memberToken;
      this.saveAdminToken(this.snapshot.room.id, response.adminToken);
      this.setSnapshot(response.snapshot);
      this.connect();
    },
    async uploadCookie(source: 'cloud' | 'qq' | 'migu', cookie: string) {
      if (!this.snapshot) return;
      await roomRequest(
        `/api/v1/rooms/${this.snapshot.room.id}/credentials/${source}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            cookie,
            ...this.identity,
            adminToken: this.adminToken
          })
        }
      );
      // Refresh only the credential metadata. Reopening the room here would
      // unnecessarily replace the active realtime connection.
      this.snapshot.credentialSources = [
        ...new Set([...this.snapshot.credentialSources, source])
      ];
    },
    async removeCookie(source: 'cloud' | 'qq' | 'migu') {
      if (!this.snapshot) return;
      await roomRequest(
        `/api/v1/rooms/${this.snapshot.room.id}/credentials/${source}`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            ...this.identity,
            adminToken: this.adminToken
          })
        }
      );
      await this.open(this.snapshot.room.id);
    },
    async reportResolvedMusic(music: Music) {
      if (!this.snapshot || !this.isAdmin || !music.url) return;
      await roomRequest(`/api/v1/rooms/${this.snapshot.room.id}/resolved`, {
        method: 'POST',
        body: JSON.stringify({
          music,
          quality: useSettingStore().playQuality,
          ...this.identity,
          adminToken: this.adminToken
        })
      });
    },
    getLocalCookie(source: 'cloud' | 'qq' | 'migu') {
      const account = useSettingStore().userInfo[source];
      // A cookie value can remain in an API module after an expired session or
      // a failed login. Only upload it when the settings store still has a
      // verified account identity for that music source.
      if (!account?.id) return '';
      const cookie = account.cookie;
      if (!cookie) return '';
      if (typeof cookie === 'string') return cookie.trim();
      return Object.entries(cookie)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    },
    async uploadLocalCookieIfMissing(source: 'cloud' | 'qq' | 'migu') {
      if (!this.snapshot || !this.isAdmin) return;
      if (this.snapshot.credentialSources.includes(source)) return;
      const cookie = this.getLocalCookie(source);
      if (!cookie) return;
      try {
        await roomRequest(
          `/api/v1/rooms/${this.snapshot.room.id}/credentials/${source}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              cookie,
              ...this.identity,
              adminToken: this.adminToken
            })
          }
        );
        // Keep the current snapshot in sync without reopening the room and
        // creating another realtime connection while audio is being loaded.
        this.snapshot.credentialSources = [
          ...new Set([...this.snapshot.credentialSources, source])
        ];
        console.log('[在线歌房] 已将本地 Cookie 上传到服务端', { source });
      } catch (error) {
        console.warn('[在线歌房] 本地 Cookie 上传失败', { source, error });
      }
    },
    async syncAdminCookies() {
      if (!this.snapshot || !this.isAdmin || this.adminCookieSyncing) return;
      this.adminCookieSyncing = true;
      try {
        for (const source of ['cloud', 'qq', 'migu'] as const) {
          await this.uploadLocalCookieIfMissing(source);
        }
      } catch (error) {
        console.warn('[在线歌房] 自动同步 Cookie 失败', error);
      } finally {
        this.adminCookieSyncing = false;
      }
    },
    async dissolve() {
      if (!this.snapshot) return;
      await roomRequest(`/api/v1/rooms/${this.snapshot.room.id}/dissolve`, {
        method: 'POST',
        headers: { 'X-Room-Admin': this.adminToken },
        body: JSON.stringify({ ...this.identity })
      });
      this.leave(false);
    },
    saveAdminToken(roomId: string, token: string) {
      const tokens = readAdminTokens();
      tokens[roomId] = token;
      writeAdminTokens(tokens);
    },
    cachedAdminTokenRoomIds() {
      return Object.keys(readAdminTokens());
    },
    removeAdminTokenCache(roomIds: string[]) {
      const removed = new Set(
        roomIds.map(roomId => String(roomId).toUpperCase())
      );
      const tokens = readAdminTokens();
      let changed = false;
      for (const roomId of Object.keys(tokens)) {
        if (!removed.has(roomId.toUpperCase())) continue;
        delete tokens[roomId];
        changed = true;
      }
      if (changed) writeAdminTokens(tokens);
    },
    setVolume(value: number) {
      this.volume = Math.max(0, Math.min(100, value));
      localStorage.setItem(roomVolumeKey, this.volume.toString());
      if (this.audio) this.audio.volume = this.volume / 100;
    },
    resetLoadedAudio() {
      this.audioResolveAbort?.abort();
      this.audioResolveAbort = null;
      this.audio?.pause();
      this.localPlaying = false;
      this.loadedMusicKey = '';
      this.loadedQueueId = '';
      this.pendingSeekSeconds = null;
      if (this.audioResolveTimer) clearTimeout(this.audioResolveTimer);
      this.audioResolveTimer = null;
    },
    scheduleAudioSync(delay = 0) {
      this.audioSyncPending = true;
      if (this.audioRetryTimer) clearTimeout(this.audioRetryTimer);
      this.audioRetryTimer = setTimeout(() => {
        this.audioRetryTimer = null;
        if (!this.snapshot) return;
        void this.syncAudio();
      }, delay);
    },
    async syncAudio() {
      if (!this.snapshot) return;
      if (this.syncingAudio) {
        // A snapshot can arrive while an address is being resolved. Remember
        // it so the follow-up track sync is never silently dropped.
        this.audioSyncPending = true;
        return;
      }
      const current = this.snapshot.state.current;
      if (!current) {
        this.resetLoadedAudio();
        this.audioNeedsGesture = false;
        return;
      }
      if (current.music.noRight) {
        // This comes from the music source metadata. Do not repeatedly try
        // to resolve a URL that the source has already marked unavailable.
        this.command('track_unavailable', {
          queueId: current.id,
          noRight: true
        });
        return;
      }
      this.syncingAudio = true;
      this.audioSyncPending = false;
      // Queue IDs are unique even when somebody queues the same song twice.
      // A music ID alone therefore cannot identify the active audio source.
      const expectedKey = `${current.id}:${current.music.type}:${current.music.id}`;
      try {
        if (!this.audio) {
          this.audio = new Audio();
          this.audio.volume = this.volume / 100;
          this.audio.addEventListener('playing', () => {
            this.localPlaying = true;
            this.audioNeedsGesture = false;
          });
          this.audio.addEventListener('pause', () => {
            const wasPlaying = this.localPlaying;
            this.localPlaying = false;
            // Recover from a transient local pause while the room is still
            // playing. Intentional pauses either arrive with Playing=false or
            // happen while a new source is being synchronized.
            if (
              wasPlaying &&
              !this.syncingAudio &&
              !this.audio?.ended &&
              this.snapshot?.state.playback.playing
            )
              this.scheduleAudioSync(150);
          });
          this.audio.addEventListener(
            'ended',
            () => (this.localPlaying = false)
          );
          this.audio.addEventListener('loadedmetadata', () => {
            if (this.pendingSeekSeconds != null) {
              this.seekLocalAudio(this.pendingSeekSeconds);
            }
          });
          this.audio.addEventListener('ended', () => {
            const item = this.snapshot?.state.current;
            // Ignore an end event from a source that no longer belongs to the
            // current queue item, such as after a manual track switch.
            if (item && item.id === this.loadedQueueId && this.isAdmin)
              this.command('track_ended', { queueId: item.id });
          });
        }
        if (this.loadedMusicKey !== expectedKey) {
          if (this.audioResolveTimer) clearTimeout(this.audioResolveTimer);
          this.audioResolveTimer = null;
          let music: Music | null = null;
          const resolveAbort = new AbortController();
          this.audioResolveAbort?.abort();
          this.audioResolveAbort = resolveAbort;
          try {
            try {
              const result = await roomRequest<{ music: Music }>(
                `/api/v1/rooms/${this.snapshot.room.id}/resolve`,
                {
                  method: 'POST',
                  signal: resolveAbort.signal,
                  body: JSON.stringify({
                    music: current.music,
                    quality: useSettingStore().playQuality,
                    ...this.identity
                  })
                }
              );
              music = result.music;
            } catch {
              if (resolveAbort.signal.aborted) return;
              // Keep the existing Web resolver as a compatibility fallback if
              // the server resolver is unavailable. An administrator also
              // shares the short-lived URL with the room as a fallback.
              music = await musicAPI.musicDetail({ ...current.music });
              if (music?.url) {
                console.log('[在线歌房] 本地解析成功', {
                  roomId: this.snapshot.room.id,
                  source: current.music.type,
                  id: current.music.id,
                  name: current.music.name,
                  url: music.url
                });
                if (this.isAdmin && current.music.type !== 'local') {
                  await this.uploadLocalCookieIfMissing(current.music.type);
                  this.reportResolvedMusic(music).catch(error =>
                    console.warn('[在线歌房] 播放地址共享失败', error)
                  );
                }
              }
            }
          } finally {
            if (this.audioResolveAbort === resolveAbort)
              this.audioResolveAbort = null;
          }
          // The active track changed while this URL was resolving. Its result
          // belongs to the old item and must not overwrite the current source.
          if (this.snapshot?.state.current?.id !== current.id) return;
          if (music?.noRight) {
            this.command('track_unavailable', {
              queueId: current.id,
              noRight: true
            });
            return;
          }
          if (!music?.url) {
            this.audioNeedsGesture = true;
            this.lastError = '当前歌曲暂未取得可播放地址，请等待管理员解析完成';
            return;
          }
          title.value = `${music.name} - ${music.singer} - Musiche`;
          this.audio.src = music.url;
          this.loadedMusicKey = expectedKey;
          this.loadedQueueId = current.id;
          this.audioResolveTimer = setTimeout(() => {
            this.loadedMusicKey = '';
            // Keep the queue ID while refreshing. If the resolver has a
            // transient failure, the already-playing URL can continue rather
            // than being mistaken for an unrelated stale source.
            this.scheduleAudioSync();
          }, 300000);
          navigator.mediaSession.metadata = new MediaMetadata({
            title: `${music.name} - ${music.singer} - Musiche`,
            album: music.album || undefined,
            artist: music.singer || undefined,
            artwork: music.image
              ? [
                  {
                    src: music.largeImage || music.mediumImage || music.image
                  }
                ]
              : []
          });
        }
        const playback = this.snapshot.state.playback;
        const target = Math.max(
          0,
          playback.positionMs / 1000 +
            (playback.playing
              ? Math.max(
                  0,
                  Date.now() - new Date(playback.updatedAt).getTime()
                ) / 1000
              : 0)
        );
        if (Math.abs(this.audio.currentTime - target) > 1.2)
          this.seekLocalAudio(target);
        if (playback.playing) {
          try {
            await this.audio.play();
            this.localPlaying = !this.audio.paused;
            this.audioNeedsGesture = false;
          } catch {
            // A refreshed page has no user activation, so browsers block sound
            // until the member explicitly resumes local playback.
            this.audioNeedsGesture = true;
            this.localPlaying = false;
          }
        } else {
          this.audio.pause();
          this.localPlaying = false;
          this.audioNeedsGesture = false;
        }
      } catch (error: any) {
        if (this.snapshot?.state.current?.id !== current.id) return;
        const activeQueueId = this.snapshot?.state.current?.id || '';
        const canKeepPlaying = Boolean(
          activeQueueId &&
          activeQueueId === this.loadedQueueId &&
          this.audio &&
          !this.audio.paused
        );
        // A temporary URL refresh failure must not turn a working playback
        // into a pause that requires the listener to click play again.
        if (canKeepPlaying) this.audioNeedsGesture = false;
        else {
          this.audio?.pause();
          this.localPlaying = false;
          this.audioNeedsGesture = true;
        }
        this.lastError = error?.message || '房间音频同步失败';
      } finally {
        this.syncingAudio = false;
        if (this.audioSyncPending && this.snapshot) this.scheduleAudioSync();
      }
    },
    leave(clearCurrent = true) {
      this.stopReconnect();
      this.transport?.close();
      this.transport = null;
      this.connected = false;
      this.transportFailureCode = '';
      this.audio?.pause();
      this.localPlaying = false;
      this.audioNeedsGesture = false;
      this.memberToken = '';
      this.snapshot = null;
      this.chatKey = '';
      this.chatKeyRoomId = '';
      this.chatMessages = [];
      this.loadedMusicKey = '';
      this.loadedQueueId = '';
      this.audioResolveAbort?.abort();
      this.audioResolveAbort = null;
      this.pendingSeekSeconds = null;
      this.audioSyncPending = false;
      if (this.audioResolveTimer) clearTimeout(this.audioResolveTimer);
      this.audioResolveTimer = null;
      if (this.audioRetryTimer) clearTimeout(this.audioRetryTimer);
      this.audioRetryTimer = null;
      if (clearCurrent) localStorage.removeItem(currentRoomKey);
    },
    async resumeAudio() {
      if (!this.snapshot?.state.playback.playing) return;
      if (!this.audio?.src) {
        this.loadedMusicKey = '';
        await this.syncAudio();
        return;
      }
      const playback = this.snapshot.state.playback;
      const target = Math.max(
        0,
        playback.positionMs / 1000 +
          Math.max(0, Date.now() - new Date(playback.updatedAt).getTime()) /
            1000
      );
      if (Number.isFinite(this.audio.duration)) {
        this.seekLocalAudio(target);
      } else {
        this.pendingSeekSeconds = target;
      }
      try {
        await this.audio.play();
        this.localPlaying = !this.audio.paused;
        this.audioNeedsGesture = false;
      } catch {
        this.audioNeedsGesture = true;
        this.localPlaying = false;
      }
    },
    seekLocalAudio(target: number) {
      if (!this.audio) return;
      if (!Number.isFinite(this.audio.duration)) {
        this.pendingSeekSeconds = target;
        return;
      }
      this.audio.currentTime = Math.min(
        Math.max(0, target),
        this.audio.duration || target
      );
      this.pendingSeekSeconds = null;
    }
  }
});
