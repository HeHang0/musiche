import { defineStore } from 'pinia';
import { useTitle } from '@vueuse/core';
import * as musicAPI from '../utils/api/api';
import { useSettingStore } from './setting';
import type { Music } from '../utils/type';
import {
  createRoomIdentity,
  hasRoomServerAddressConfigured,
  roomRequest,
  roomWebSocketAddress,
  type RoomChatMessage,
  type RoomIdentity,
  type RoomServiceConfig,
  type RoomSnapshot,
  type RoomSummary
} from '../utils/room';

export const currentRoomKey = 'musiche-room-current-id';
const adminTokensKey = 'musiche-room-admin-tokens';
const roomVolumeKey = 'musiche-room-volume';
const title = useTitle();

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
    heartbeatTimer: null as ReturnType<typeof setInterval> | null,
    socket: null as WebSocket | null,
    socketFailureCode: '',
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
    audioResolveTimer: null as ReturnType<typeof setTimeout> | null,
    audioRetryTimer: null as ReturnType<typeof setTimeout> | null,
    adminCookieSyncing: false,
    syncingAudio: false,
    chatMessages: [] as RoomChatMessage[]
  }),
  getters: {
    room: state => state.snapshot?.room || null,
    isAdmin: state => Boolean(state.snapshot?.isAdmin),
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
    }) {
      const response = await roomRequest<{
        snapshot: RoomSnapshot;
        adminToken: string;
        memberToken: string;
      }>('/api/v1/rooms', {
        method: 'POST',
        body: JSON.stringify({ ...payload, ...this.identity })
      });
      this.memberToken = response.memberToken;
      this.saveAdminToken(response.snapshot.room.id, response.adminToken);
      this.setSnapshot(response.snapshot);
      this.connect();
    },
    async join(
      roomId: string,
      payload: { nickname: string; entryPassword: string }
    ) {
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
      // discard an invalid token before opening the WebSocket.
      if (token && !response.snapshot.isAdmin) deleteAdminToken(roomId);
      this.memberToken = response.memberToken;
      this.setSnapshot(response.snapshot);
      if (connect) this.connect();
    },
    setSnapshot(snapshot: RoomSnapshot) {
      const previous = this.snapshot;
      if (previous && previous.room.id !== snapshot.room.id)
        this.chatMessages = [];
      this.snapshot = snapshot;
      this.lastError = '';
      localStorage.setItem(currentRoomKey, snapshot.room.id);
      if (snapshot.isAdmin) void this.syncAdminCookies();
      void this.syncAudio();
    },
    connect() {
      if (!this.snapshot) return;
      this.stopReconnect();
      this.stopHeartbeat();
      this.socket?.close();
      const query = new URLSearchParams({
        roomId: this.snapshot.room.id,
        memberToken: this.memberToken
      });
      const socket = new WebSocket(roomWebSocketAddress('/ws?' + query));
      this.socket = socket;
      this.socketFailureCode = '';
      let opened = false;
      let rejectionCode = '';
      socket.onopen = () => {
        if (this.socket !== socket) return;
        opened = true;
        this.connected = true;
        this.socketFailureCode = '';
        this.startHeartbeat(socket);
        // Establish administrator privileges after the normal member
        // connection is ready. This keeps the admin credential out of the
        // WebSocket URL and also lets a guest become an administrator later.
        const adminToken = this.adminToken;
        if (adminToken) {
          socket.send(
            JSON.stringify({
              type: 'command',
              action: 'auth_admin',
              adminToken
            })
          );
        }
      };
      socket.onmessage = event => {
        const code = this.handleEvent(event.data);
        if (code) rejectionCode = code;
      };
      socket.onclose = event => {
        // Closing an old socket while switching administrator credentials must
        // never mark the newer socket as disconnected.
        if (this.socket !== socket) return;
        this.connected = false;
        this.stopHeartbeat();
        if (
          !rejectionCode &&
          event.code !== 1000 &&
          this.socketFailureCode !== 'transport_error'
        ) {
          this.socketFailureCode = 'transport_error';
          this.lastError = opened
            ? '歌房 WebSocket 连接意外断开'
            : '无法建立歌房 WebSocket 连接，请检查反向代理是否支持 WebSocket';
          console.error('[在线歌房] WebSocket 非正常关闭', {
            code: event.code,
            reason: event.reason,
            opened
          });
        }
        const roomId = this.snapshot?.room.id;
        if (
          roomId &&
          (rejectionCode === 'missing_member_token' ||
            rejectionCode === 'invalid_member_token')
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
          ].includes(rejectionCode)
        ) {
          const delay = ['room_full', 'connection_limit_reached'].includes(
            rejectionCode
          )
            ? 10000
            : 2000;
          this.reconnectTimer = setTimeout(() => this.connect(), delay);
        }
      };
      socket.onerror = () => {
        if (this.socket !== socket || rejectionCode) return;
        this.socketFailureCode = 'transport_error';
        this.lastError = opened
          ? '歌房 WebSocket 连接异常'
          : '无法建立歌房 WebSocket 连接，请检查反向代理是否支持 WebSocket';
        console.error('[在线歌房] WebSocket 连接失败', {
          address: roomWebSocketAddress('/ws'),
          opened
        });
        socket.close();
      };
    },
    stopReconnect() {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    },
    startHeartbeat(socket: WebSocket) {
      this.stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.socket !== socket || socket.readyState !== WebSocket.OPEN)
          return;
        socket.send(JSON.stringify({ type: 'command', action: 'heartbeat' }));
      }, 20000);
    },
    stopHeartbeat() {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
            this.chatMessages.push(chat);
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
              'invalid_message'
            ].includes(code)
          ) {
            this.socketFailureCode = code;
            console.error('[在线歌房] WebSocket 服务端拒绝连接', {
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
    command(action: string, data: Record<string, any> = {}) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.lastError = '正在连接歌房服务';
        return;
      }
      this.socket.send(
        JSON.stringify({
          type: 'command',
          action,
          adminToken: this.adminToken,
          ...data
        })
      );
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
    seek(positionMs: number) {
      console.log('[在线歌房] seek', positionMs);
      this.command('seek', { positionMs: Math.round(positionMs) });
    },
    chat(content: string, image = '') {
      this.command('chat', { content, image });
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
      const socket = this.socket;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'command',
            action: 'auth_admin',
            adminToken: response.adminToken
          })
        );
      } else if (!socket || socket.readyState === WebSocket.CLOSED) {
        await this.open(roomId);
      }
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
      // unnecessarily replace the active WebSocket connection.
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
        // creating another WebSocket connection while audio is being loaded.
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
    scheduleAudioSync(delay = 0) {
      if (this.audioRetryTimer) clearTimeout(this.audioRetryTimer);
      this.audioRetryTimer = setTimeout(() => {
        this.audioRetryTimer = null;
        if (!this.snapshot) return;
        if (this.syncingAudio) {
          this.scheduleAudioSync(250);
          return;
        }
        void this.syncAudio();
      }, delay);
    },
    async syncAudio() {
      if (this.syncingAudio || !this.snapshot) return;
      const current = this.snapshot.state.current;
      if (!current) {
        this.audio?.pause();
        return;
      }
      this.syncingAudio = true;
      const expectedKey = `${current.music.type}:${current.music.id}`;
      try {
        if (!this.audio) {
          this.audio = new Audio();
          this.audio.volume = this.volume / 100;
          this.audio.addEventListener('playing', () => {
            this.localPlaying = true;
            this.audioNeedsGesture = false;
          });
          this.audio.addEventListener(
            'pause',
            () => (this.localPlaying = false)
          );
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
            if (item && this.isAdmin)
              this.command('track_ended', { queueId: item.id });
          });
        }
        if (this.loadedMusicKey !== expectedKey) {
          let music: Music | null = null;
          try {
            const result = await roomRequest<{ music: Music }>(
              `/api/v1/rooms/${this.snapshot.room.id}/resolve`,
              {
                method: 'POST',
                body: JSON.stringify({ music: current.music, ...this.identity })
              }
            );
            music = result.music;
          } catch {
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
          if (!music?.url || this.snapshot?.state.current?.id !== current.id) {
            this.audioNeedsGesture = true;
            this.lastError = '当前歌曲暂未取得可播放地址，请等待管理员解析完成';
            return;
          }
          title.value = `${music.name} - ${music.singer} - Musiche`;
          this.audio.src = music.url;
          this.loadedMusicKey = expectedKey;
          if (this.audioResolveTimer) clearTimeout(this.audioResolveTimer);
          this.audioResolveTimer = setTimeout(() => {
            this.loadedMusicKey = '';
            void this.syncAudio();
          }, 305000);
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
        this.audio?.pause();
        this.localPlaying = false;
        this.audioNeedsGesture = true;
        this.lastError = error?.message || '房间音频同步失败';
      } finally {
        this.syncingAudio = false;
      }
    },
    leave(clearCurrent = true) {
      this.stopReconnect();
      this.stopHeartbeat();
      this.socket?.close();
      this.socket = null;
      this.connected = false;
      this.socketFailureCode = '';
      this.audio?.pause();
      this.localPlaying = false;
      this.audioNeedsGesture = false;
      this.memberToken = '';
      this.snapshot = null;
      this.chatMessages = [];
      this.loadedMusicKey = '';
      this.pendingSeekSeconds = null;
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
