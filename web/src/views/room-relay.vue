<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { LogoImage } from '../utils/logo';
import { musicTypeInfo } from '../utils/platform';
import RoomPlayDetail from '../components/room/RoomPlayDetail.vue';
import type { RoomChatMessage, RoomSnapshot } from '../utils/room';
import {
  decodeRoomRelayPayload,
  encodeRoomRelayPayload,
  roomRelayProtocol,
  waitForIceGathering,
  type RoomRelayAnswer,
  type RoomRelayOffer,
  type RoomRelayStateMessage
} from '../utils/room-relay';

const route = useRoute();
const offer = ref<RoomRelayOffer | null>(null);
const answerLink = ref('');
const status = ref('正在读取邀请…');
const snapshot = ref<RoomSnapshot | null>(null);
const chatMessages = ref<RoomChatMessage[]>([]);
const chatText = ref('');
const audio = ref<HTMLAudioElement | null>(null);
const volume = ref(80);
const relayConnected = ref(false);
const playDetailVisible = ref(false);
const currentLyric = ref('');
const lyricsText = ref('');
const clock = ref(Date.now());
const profileVisible = ref(false);
const nicknameKey = 'musiche-room-relay-nickname';
const avatarKey = 'musiche-room-avatar';
const relayIdKey = 'musiche-room-relay-id';
const nickname = ref(localStorage.getItem(nicknameKey) || '局域网访客');
const draftNickname = ref(nickname.value);
const relayId = localStorage.getItem(relayIdKey) || crypto.randomUUID();
localStorage.setItem(relayIdKey, relayId);
const avatarAssets = import.meta.glob('../assets/images/qq_head/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;
const builtInAvatars = Object.entries(avatarAssets)
  .map(([path, url]) => ({ key: path.split('/').pop() || '', url }))
  .filter(item => item.key)
  .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
const storedAvatar = localStorage.getItem(avatarKey) || '';
const selectedAvatar = ref(
  builtInAvatars.some(item => item.key === storedAvatar)
    ? storedAvatar
    : builtInAvatars[0]?.key || ''
);
const draftAvatar = ref(selectedAvatar.value);
let peer: RTCPeerConnection | null = null;
let channel: RTCDataChannel | null = null;
let remoteAudioStream: MediaStream | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const current = computed(() => snapshot.value?.state.current);
const connected = computed(() => relayConnected.value);
const queue = computed(() => snapshot.value?.state.queue || []);
const positionSeconds = computed(() => {
  const playback = snapshot.value?.state.playback;
  if (!playback) return 0;
  return Math.max(
    0,
    playback.positionMs / 1000 +
      (playback.playing
        ? Math.max(0, clock.value - new Date(playback.updatedAt).getTime()) /
          1000
        : 0)
  );
});
const durationSeconds = computed(() => {
  const value = current.value?.music.duration || '';
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return audio.value?.duration || 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
});

function sourceImage(type = '') {
  return (musicTypeInfo as any)[type]?.image || LogoImage;
}

function avatarImage(avatar = '', memberId = '') {
  const selected = builtInAvatars.find(item => item.key === avatar);
  if (selected) return selected.url;
  if (!builtInAvatars.length) return LogoImage;
  let hash = 0;
  for (const char of memberId || 'guest')
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return builtInAvatars[Math.abs(hash) % builtInAvatars.length].url;
}

function chatAvatar(memberId: string, avatar = '') {
  return avatarImage(avatar, memberId);
}

function relayPayloadFromLocation() {
  const hash = location.hash;
  if (!hash.startsWith('#relay=')) throw new Error('邀请链接缺少连接信息');
  return decodeRoomRelayPayload<RoomRelayOffer>(hash);
}

async function createAnswer() {
  closeRelayConnection();
  answerLink.value = '';
  snapshot.value = null;
  chatMessages.value = [];
  status.value = '正在生成应答…';
  const invitation = relayPayloadFromLocation();
  if (
    invitation.kind !== 'offer' ||
    invitation.version !== roomRelayProtocol ||
    invitation.expiresAt < Date.now()
  )
    throw new Error('邀请无效、版本不匹配或已经过期');
  offer.value = invitation;
  peer = new RTCPeerConnection({ iceServers: [] });
  peer.addEventListener('connectionstatechange', () => {
    const state = peer?.connectionState;
    relayConnected.value = state === 'connected';
    status.value =
      state === 'connected'
        ? '已通过局域网连接'
        : state === 'failed'
          ? '连接失败，请重新配对'
          : state === 'disconnected'
            ? '中继连接已断开'
            : '等待中继用户接回应答…';
  });
  peer.addEventListener('datachannel', event => {
    channel = event.channel;
    channel.addEventListener('open', () => {
      relayConnected.value = true;
      status.value = '已通过局域网连接';
    });
    channel.addEventListener('close', () => (relayConnected.value = false));
    channel.addEventListener('message', handleRelayMessage);
  });
  peer.addEventListener('track', event => {
    remoteAudioStream = event.streams[0] || new MediaStream([event.track]);
    void nextTick(bindRemoteAudio);
  });
  await peer.setRemoteDescription(invitation.description);
  await peer.setLocalDescription(await peer.createAnswer());
  await waitForIceGathering(peer);
  const answer: RoomRelayAnswer = {
    version: roomRelayProtocol,
    kind: 'answer',
    sessionId: invitation.sessionId,
    secret: invitation.secret,
    description: peer.localDescription!.toJSON()
  };
  const url = new URL(location.href);
  url.pathname = route.path;
  url.hash = `relay=${encodeRoomRelayPayload(answer)}`;
  answerLink.value = url.toString();
  status.value = '请把应答链接发回中继用户';
}

function closeRelayConnection() {
  relayConnected.value = false;
  channel?.close();
  peer?.close();
  channel = null;
  peer = null;
  remoteAudioStream = null;
  if (audio.value) audio.value.srcObject = null;
}

function bindRemoteAudio() {
  if (!audio.value || !remoteAudioStream) return;
  audio.value.srcObject = remoteAudioStream;
  audio.value.volume = volume.value / 100;
  void audio.value.play().catch(() => {
    status.value = '已连接，点击播放开启声音';
  });
}

function startPlayCheck() {
  // Match the normal room behavior: once the user has interacted with the
  // page, use that gesture to recover local audio blocked by autoplay rules.
  if (!snapshot.value?.state.playback.playing || !audio.value?.paused) return;
  void audio.value.play().catch(error => {
    console.warn('[局域网歌房] 用户手势恢复播放失败', error);
  });
}

function handleRelayMessage(event: MessageEvent) {
  try {
    const message = JSON.parse(String(event.data)) as RoomRelayStateMessage;
    if (message.type !== 'state' || message.secret !== offer.value?.secret)
      return;
    snapshot.value = message.snapshot;
    snapshot.value.nickname = nickname.value;
    snapshot.value.avatar = selectedAvatar.value;
    snapshot.value.memberId = `relay-local-${relayId}`;
    for (const item of [
      ...(message.snapshot.state.queue || []),
      ...(message.snapshot.state.history || [])
    ]) {
      const image = sourceImage(item.music.type);
      item.music.image = image;
      item.music.mediumImage = image;
      item.music.largeImage = image;
    }
    const playingMusic = message.snapshot.state.current?.music;
    if (playingMusic && !playingMusic.image) {
      const fallback = sourceImage(playingMusic.type);
      playingMusic.image = fallback;
      playingMusic.mediumImage = fallback;
      playingMusic.largeImage = fallback;
    }
    chatMessages.value = message.chatMessages;
    currentLyric.value = message.lyric || '';
    if (typeof message.lyricsText === 'string')
      lyricsText.value = message.lyricsText;
    if (channel?.readyState === 'open')
      channel.send(
        JSON.stringify({ type: 'relay_ack', secret: offer.value.secret })
      );
  } catch {
    // Ignore malformed relay messages.
  }
}

async function copyAnswer() {
  await navigator.clipboard.writeText(answerLink.value);
  ElMessage.success('应答链接已复制，请发回中继用户');
}

function sendChat(value?: string | Event) {
  const content = (typeof value === 'string' ? value : chatText.value).trim();
  if (!content || channel?.readyState !== 'open' || !offer.value) return;
  channel.send(
    JSON.stringify({
      type: 'relay_chat',
      secret: offer.value.secret,
      relayId,
      nickname: nickname.value,
      avatar: selectedAvatar.value,
      content
    })
  );
  chatText.value = '';
}

function openProfile() {
  draftNickname.value = nickname.value;
  draftAvatar.value = selectedAvatar.value;
  profileVisible.value = true;
}

function saveProfile() {
  const value = draftNickname.value.trim().slice(0, 24);
  if (!value) return;
  nickname.value = value;
  selectedAvatar.value = draftAvatar.value;
  localStorage.setItem(nicknameKey, value);
  localStorage.setItem(avatarKey, selectedAvatar.value);
  if (snapshot.value) {
    snapshot.value.nickname = value;
    snapshot.value.avatar = selectedAvatar.value;
  }
  profileVisible.value = false;
}

function setVolume(value: number) {
  volume.value = value;
  if (audio.value) audio.value.volume = value / 100;
}

onMounted(() => {
  clockTimer = setInterval(() => (clock.value = Date.now()), 500);
  void createAnswer().catch(error => (status.value = error.message));
});
watch(
  () => route.fullPath,
  () => void createAnswer().catch(error => (status.value = error.message))
);
watch(audio, bindRemoteAudio);
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  closeRelayConnection();
});
</script>

<template>
  <main class="music-room relay-room">
    <audio ref="audio" autoplay playsinline />
    <section class="music-room-active relay-active" @click="startPlayCheck">
      <header class="music-room-active-header relay-header">
        <div class="music-room-active-header-title relay-header-title">
          <b>{{ snapshot?.room.name || offer?.roomName || '歌房分享' }}</b>
          <span v-if="snapshot" class="relay-members">
            {{ snapshot.room.onlineCount }} / {{ snapshot.room.maxMembers }} 人
          </span>
          <span :class="['relay-status', { online: connected }]">{{
            status
          }}</span>
        </div>
        <button
          class="music-room-member-profile relay-profile"
          type="button"
          @click="openProfile">
          <img :src="avatarImage(selectedAvatar, relayId)" alt="我的头像" />
          <span>{{ nickname }}</span>
        </button>
      </header>

      <section v-if="answerLink && !connected" class="relay-pairing">
        <h3>还差最后一步</h3>
        <p>将下面的应答链接发回中继用户，由对方粘贴确认后即可连接。</p>
        <el-input
          :model-value="answerLink"
          readonly
          type="textarea"
          :rows="4" />
        <el-button type="primary" @click="copyAnswer">复制应答链接</el-button>
      </section>

      <main v-if="snapshot" class="music-room-active-main relay-content">
        <section class="music-room-queue relay-queue">
          <div
            class="music-room-panel-title music-room-queue-title relay-panel-title">
            已点歌曲 <small>{{ queue.length }}</small>
          </div>
          <div v-if="current" class="music-room-current-row relay-current">
            <img
              :src="current.music.image || sourceImage(current.music.type)" />
            <div>
              <b>正在播放</b
              ><span
                >{{ current.music.name }} · {{ current.music.singer }}</span
              >
            </div>
          </div>
          <el-scrollbar class="music-room-queue-list relay-queue-list">
            <el-empty
              v-if="!queue.length"
              description="还没有人点歌"
              :image-size="80" />
            <div
              v-for="(item, index) in queue"
              :key="item.id"
              class="music-room-queue-item relay-queue-item">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="music-room-cover music-room-queue-cover">
                <img
                  :src="sourceImage(item.music.type)"
                  :alt="item.music.type" />
              </div>
              <div class="music-room-queue-item-info text-overflow-1">
                <b class="text-overflow-1">{{ item.music.name }}</b>
                <small class="text-overflow-1"
                  >{{ item.music.singer }} ·
                  {{ item.requestedName }} 点歌</small
                >
              </div>
            </div>
          </el-scrollbar>
        </section>
        <section class="music-room-control relay-control">
          <div class="music-room-player relay-player">
            <div
              class="music-room-player-image"
              role="button"
              tabindex="0"
              title="打开播放详情"
              @click="playDetailVisible = true">
              <img
                class="music-room-player-image-disc rotation-animation"
                :class="
                  snapshot.state.playback.playing && !audio?.paused
                    ? 'rotation-animation-running'
                    : ''
                "
                src="../assets/images/disc.png" />
              <img
                class="music-room-player-image-album rotation-animation"
                :class="
                  snapshot.state.playback.playing && !audio?.paused
                    ? 'rotation-animation-running'
                    : ''
                "
                :src="
                  current?.music.mediumImage ||
                  current?.music.image ||
                  sourceImage(current?.music.type)
                "
                alt="正在播放的歌曲封面" />
            </div>
            <div class="music-room-player-info">
              <h2 class="text-overflow-1">
                {{ current?.music.name || '等待播放' }}
              </h2>
              <p class="text-overflow-1">
                {{
                  current
                    ? `${current.music.singer} · ${current.music.album || '未知专辑'}`
                    : '等待分享者播放歌曲'
                }}
              </p>
              <div class="music-room-player-progress">
                <span
                  >{{ Math.floor(positionSeconds / 60) }}:{{
                    String(Math.floor(positionSeconds % 60)).padStart(2, '0')
                  }}</span
                >
                <div class="music-room-progress-slider">
                  <el-slider
                    :model-value="positionSeconds"
                    :max="durationSeconds || 1"
                    disabled
                    :show-tooltip="false" />
                </div>
                <span
                  >{{ Math.floor(durationSeconds / 60) }}:{{
                    String(Math.floor(durationSeconds % 60)).padStart(2, '0')
                  }}</span
                >
              </div>
              <div class="music-room-player-actions">
                <el-button v-if="audio?.paused" circle @click="audio?.play()"
                  ><span class="music-icon">播</span></el-button
                >
                <span v-if="audio?.paused">点击播放以恢复本地声音</span>
                <span v-else>分享者控制播放 · 你可调整本地音量</span>
                <div class="music-room-volume">
                  <span class="music-icon">{{ volume > 0 ? '音' : '静' }}</span
                  ><el-slider
                    :model-value="volume"
                    :show-tooltip="false"
                    @input="setVolume" />
                </div>
              </div>
              <div
                class="music-room-player-lyric text-overflow-1"
                @click="playDetailVisible = true">
                {{ currentLyric }}
              </div>
            </div>
          </div>
          <div class="music-room-chat relay-chat">
            <div
              class="music-room-panel-title music-room-chat-title relay-panel-title">
              聊天
            </div>
            <el-scrollbar class="music-room-chat-list relay-chat-list">
              <div
                v-for="message in chatMessages"
                :key="message.id"
                :class="[
                  'music-room-chat-message',
                  'relay-message',
                  {
                    'music-room-chat-system': message.system,
                    system: message.system,
                    self: message.memberId === `relay-${relayId}`
                  }
                ]">
                <img
                  v-if="!message.system"
                  class="music-room-chat-avatar"
                  :src="avatarImage(message.avatar, message.memberId)" />
                <div class="music-room-chat-body">
                  <b v-if="!message.system">{{ message.nickname }}</b>
                  <div class="music-room-chat-content">
                    <span class="music-room-chat-text">{{
                      message.content
                    }}</span>
                  </div>
                </div>
              </div>
            </el-scrollbar>
            <div class="music-room-chat-input relay-chat-send">
              <el-input
                v-model="chatText"
                maxlength="600"
                placeholder="说点什么…"
                @keyup.enter="sendChat" /><el-button
                type="primary"
                :disabled="!connected"
                @click="sendChat"
                >发送</el-button
              >
            </div>
          </div>
        </section>
      </main>
    </section>

    <RoomPlayDetail
      v-if="snapshot"
      v-model="playDetailVisible"
      :snapshot="snapshot"
      :current="current || null"
      :lyric="currentLyric"
      :lyrics-text="lyricsText"
      :position="positionSeconds"
      :duration="durationSeconds"
      :volume="volume"
      :playing="Boolean(snapshot.state.playback.playing && !audio?.paused)"
      :audio="audio"
      :current-avatar="selectedAvatar"
      :avatar-resolver="chatAvatar"
      :chat-messages="chatMessages"
      chat-enabled
      chat-placeholder="说点什么…"
      @toggle-play="audio?.paused ? audio.play() : audio?.pause()"
      @resume="audio?.play()"
      @set-volume="setVolume"
      @edit-profile="openProfile"
      @send-chat="sendChat" />

    <el-dialog
      v-model="profileVisible"
      title="修改用户信息"
      width="360px"
      append-to-body>
      <el-input
        v-model="draftNickname"
        maxlength="24"
        placeholder="请输入昵称" />
      <p>选择头像</p>
      <div class="relay-avatar-picker">
        <button
          v-for="item in builtInAvatars"
          :key="item.key"
          :class="{ selected: draftAvatar === item.key }"
          @click="draftAvatar = item.key">
          <img :src="item.url" />
        </button>
      </div>
      <template #footer
        ><el-button @click="profileVisible = false">取消</el-button
        ><el-button type="primary" @click="saveProfile"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </main>
</template>

<style scoped lang="less">
.relay-room,
.relay-active {
  height: 100%;
}
.relay-header-title {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.relay-back {
  font-family: music-icon;
  font-size: 22px;
}
.relay-members {
  padding: 5px 10px;
  border-radius: 12px;
  background: var(--music-button-info-border-color);
  font-size: 12px;
}
.relay-status {
  color: #e6a23c;
  font-size: 12px;
}
.relay-status.online {
  color: #67c23a;
}
.relay-profile {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.relay-profile img {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  object-fit: cover;
}
.relay-pairing {
  max-width: 680px;
  margin: 10vh auto;
  padding: 28px;
  border: 1px solid var(--music-side-divider-color);
  border-radius: 16px;
  background: var(--music-background);
}
.relay-pairing .el-button {
  margin-top: 14px;
}
.relay-queue .music-room-queue-cover img {
  object-fit: contain;
}
.relay-avatar-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  max-height: 260px;
  overflow: auto;
}
.relay-avatar-picker button {
  padding: 2px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent;
}
.relay-avatar-picker button.selected {
  border-color: var(--music-primary-color);
}
.relay-avatar-picker img {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
}
</style>
