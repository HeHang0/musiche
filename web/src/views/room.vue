<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { Search, Lock, Unlock } from '@element-plus/icons-vue';
import { useRoomStore } from '../stores/room';
import * as api from '../utils/api/api';
import MusicTypeEle from '../components/MusicType.vue';
import type {
  LyricLine,
  Music,
  MusicType,
  PlaylistSearchItem
} from '../utils/type';
import { LogoImage } from '../utils/logo';
import {
  messageOption,
  millisecond2Duration,
  parseLyric
} from '../utils/utils';

const roomStore = useRoomStore();
const route = useRoute();
const router = useRouter();
const roomCredentialsKey = 'musiche-room-credentials';
type RoomCredential = { nickname: string; entryPassword: string };

function readRoomCredentials(): Record<string, RoomCredential> {
  try {
    return JSON.parse(localStorage.getItem(roomCredentialsKey) || '{}');
  } catch {
    return {};
  }
}

function getRoomCredential(roomId: string) {
  const credential = readRoomCredentials()[roomId];
  return credential?.nickname ? credential : null;
}

function saveRoomCredential(roomId: string, credential: RoomCredential) {
  const credentials = readRoomCredentials();
  credentials[roomId] = {
    nickname: credential.nickname.trim(),
    entryPassword: credential.entryPassword
  };
  localStorage.setItem(roomCredentialsKey, JSON.stringify(credentials));
}

const rooms = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref('');
const loaded = ref(false);
const createVisible = ref(false);
const joinVisible = ref(false);
const adminVisible = ref(false);
const settingsVisible = ref(false);
const searchVisible = ref(false);
const targetRoomId = ref('');
const loadingList = ref(false);
const clock = ref(Date.now());
const chatText = ref('');
const nickname = ref(localStorage.getItem('musiche-room-nickname') || '');
const joinPassword = ref('');
const adminPassword = ref('');
const createForm = ref({ name: '', entryPassword: '', adminPassword: '' });
const settingsName = ref('');
const settingsEntryEnabled = ref(false);
const settingsEntryPassword = ref('');
const settingsAdminPassword = ref('');
const cookieValues = ref<Record<string, string>>({
  cloud: '',
  qq: '',
  migu: ''
});
const searchKeyword = ref('');
const searchSource = ref<MusicType>('cloud');
const searchType = ref<'music' | 'playlist'>('music');
const searchLoading = ref(false);
const searchMusics = ref<Music[]>([]);
const searchPlaylists = ref<PlaylistSearchItem[]>([]);
const playlistMusics = ref<Music[]>([]);
const playlistTitle = ref('');
const queueScrollbar = ref<any>(null);
const emojiList = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '😂',
  '🤣',
  '😊',
  '🙂',
  '🙃',
  '😉',
  '😌',
  '😍',
  '🥰',
  '😘',
  '😎',
  '🤩',
  '🥳',
  '🤔',
  '🤗',
  '😴',
  '🤤',
  '😋',
  '😜',
  '🤪',
  '😏',
  '😢',
  '😭',
  '😤',
  '😡',
  '🤯',
  '😱',
  '😳',
  '🥺',
  '🤭',
  '🤫',
  '👏',
  '🙌',
  '👍',
  '👎',
  '👌',
  '✌️',
  '🤝',
  '🙏',
  '💪',
  '❤️',
  '💔',
  '💕',
  '💯',
  '🔥',
  '⭐',
  '✨',
  '🎉',
  '🎵',
  '🎶',
  '🍻',
  '☕',
  '🌹',
  '🌈',
  '🐶',
  '🐱',
  '🦄',
  '🚀'
];
const musicSources = ['cloud', 'qq', 'migu'] as const;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const snapshot = computed(() => roomStore.snapshot);
const current = computed(() => snapshot.value?.state.current || null);
const playback = computed(() => snapshot.value?.state.playback);
const playbackLength = computed(() => current.value?.music.length || 1);
const isRoomOpen = computed(() => Boolean(snapshot.value));
const roomLyricLines = ref<LyricLine[]>([]);
const roomLyricLoading = ref(false);
const roomLyricKey = computed(() =>
  current.value ? `${current.value.music.type}:${current.value.music.id}` : ''
);
const roomLyricProgress = computed(() => {
  const length = current.value?.music.length || 0;
  if (!length) return 0;
  return Math.min(
    1000,
    Math.max(0, (roomStore.currentPosition(clock.value) / length) * 1000)
  );
});
let lastRoomLyricKey = 0;
const currentRoomLyric = computed(() => {
  if (!roomLyricLines.value.length) return '';
  let activeIndex = -1;
  for (
    let index = lastRoomLyricKey;
    index < roomLyricLines.value.length;
    index++
  ) {
    if (roomLyricLines.value[index].progress <= roomLyricProgress.value) {
      activeIndex = index;
    } else if (!roomLyricLines.value[index].text) {
      continue;
    } else {
      break;
    }
  }
  lastRoomLyricKey = activeIndex >= 0 ? lastRoomLyricKey : 0;
  return activeIndex >= 0 ? roomLyricLines.value[activeIndex].text : '';
});

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}

function currentPosition() {
  return Math.min(
    playbackLength.value,
    Math.max(0, roomStore.currentPosition(clock.value))
  );
}

function formatTime(value: number) {
  return millisecond2Duration(Math.round(value || 0));
}

function chatMemberId(memberId: string) {
  return String(memberId || '')
    .slice(-4)
    .toUpperCase();
}

watch(
  roomLyricKey,
  async key => {
    roomLyricLines.value = [];
    lastRoomLyricKey = 0;
    if (!key || !current.value) return;
    roomLyricLoading.value = true;
    try {
      const music = { ...current.value.music };
      const text = await api.lyric(music);
      if (key !== roomLyricKey.value || !text) return;
      roomLyricLines.value = parseLyric(text, music.length || 1);
    } finally {
      if (key === roomLyricKey.value) roomLyricLoading.value = false;
    }
  },
  { immediate: true }
);

async function loadRooms() {
  loadingList.value = true;
  try {
    const result = await roomStore.list(keyword.value, page.value);
    rooms.value = result.items;
    total.value = result.total;
  } catch (error: any) {
    roomStore.lastError;
    const err = error?.message || '无法加载歌房列表';
    ElMessage(messageOption(err));
  } finally {
    loadingList.value = false;
  }
}

function openCreate() {
  createForm.value = {
    name: '',
    entryPassword: '',
    adminPassword: generatePassword()
  };
  createVisible.value = true;
}

async function copyRoomLink() {
  if (!snapshot.value) return;
  const link = `${location.origin}/room?room=${snapshot.value.room.id}`;
  try {
    await navigator.clipboard?.writeText(link);
    ElMessage(messageOption('房间链接已复制'));
  } catch {
    ElMessage(messageOption(link));
  }
}

async function createRoom() {
  if (!nickname.value.trim()) {
    ElMessage(messageOption('请先填写昵称'));
    return;
  }
  try {
    await roomStore.create({ ...createForm.value, nickname: nickname.value });
    localStorage.setItem('musiche-room-nickname', nickname.value.trim());
    if (roomStore.room) {
      saveRoomCredential(roomStore.room.id, {
        nickname: nickname.value,
        entryPassword: createForm.value.entryPassword
      });
    }
    createVisible.value = false;
    router.replace('/room');
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '创建歌房失败'));
  }
}

async function openJoin(room: any) {
  targetRoomId.value = room.id;
  const saved = getRoomCredential(room.id);
  if (saved) {
    nickname.value = saved.nickname;
    joinPassword.value = saved.entryPassword;
    await joinRoom();
    return;
  }
  joinPassword.value = '';
  joinVisible.value = true;
}

async function joinRoom() {
  if (!nickname.value.trim()) {
    ElMessage(messageOption('请先填写昵称'));
    return;
  }
  try {
    await roomStore.join(targetRoomId.value, {
      nickname: nickname.value,
      entryPassword: joinPassword.value
    });
    localStorage.setItem('musiche-room-nickname', nickname.value.trim());
    saveRoomCredential(targetRoomId.value, {
      nickname: nickname.value,
      entryPassword: joinPassword.value
    });
    joinVisible.value = false;
    router.replace('/room');
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '进入歌房失败'));
  }
}

async function openRouteRoom() {
  const id = typeof route.query.room === 'string' ? route.query.room : '';
  if (!id || roomStore.room?.id === id) return;
  try {
    await roomStore.open(id);
  } catch {
    const saved = getRoomCredential(id);
    if (saved) {
      nickname.value = saved.nickname;
      joinPassword.value = saved.entryPassword;
      try {
        await roomStore.join(id, saved);
        localStorage.setItem('musiche-room-nickname', saved.nickname);
        return;
      } catch {
        // Ask for updated credentials below.
      }
    }
    targetRoomId.value = id;
    joinPassword.value = saved?.entryPassword || '';
    joinVisible.value = true;
  }
}

async function enterAdmin() {
  try {
    await roomStore.becomeAdmin(adminPassword.value);
    adminPassword.value = '';
    adminVisible.value = false;
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '管理员密码错误'));
  }
}

function openSettings() {
  if (!roomStore.isAdmin) {
    adminPassword.value = '';
    adminVisible.value = true;
    return;
  }
  settingsName.value = roomStore.room?.name || '';
  settingsEntryEnabled.value = Boolean(roomStore.room?.locked);
  settingsEntryPassword.value = '';
  settingsAdminPassword.value = '';
  cookieValues.value = { cloud: '', qq: '', migu: '' };
  settingsVisible.value = true;
}

async function saveSettings() {
  if (
    settingsEntryEnabled.value &&
    !roomStore.room?.locked &&
    !settingsEntryPassword.value.trim()
  ) {
    ElMessage(messageOption('请设置进入密码，或关闭进入密码开关'));
    return;
  }
  try {
    await roomStore.updateSettings({
      name: settingsName.value,
      entryPassword: settingsEntryEnabled.value
        ? settingsEntryPassword.value || undefined
        : '',
      adminPassword: settingsAdminPassword.value || undefined
    });
    if (roomStore.room) {
      const saved = getRoomCredential(roomStore.room.id);
      saveRoomCredential(roomStore.room.id, {
        nickname: nickname.value || roomStore.snapshot?.nickname || '',
        entryPassword: settingsEntryEnabled.value
          ? settingsEntryPassword.value || saved?.entryPassword || ''
          : ''
      });
    }
    settingsVisible.value = false;
    ElMessage(messageOption('房间设置已保存'));
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '保存设置失败'));
  }
}

async function uploadCookie(source: 'cloud' | 'qq' | 'migu') {
  try {
    await roomStore.uploadCookie(source, cookieValues.value[source]);
    cookieValues.value[source] = '';
    ElMessage(messageOption('Cookie 已加密保存到房间'));
  } catch (error: any) {
    ElMessage(messageOption(error?.message || 'Cookie 保存失败'));
  }
}

async function removeCookie(source: 'cloud' | 'qq' | 'migu') {
  try {
    await roomStore.removeCookie(source);
    ElMessage(messageOption('Cookie 已移除'));
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '操作失败'));
  }
}

function leaveRoom() {
  roomStore.leave();
  router.replace('/room');
  loadRooms();
}

function dissolveRoom() {
  ElMessageBox.confirm(
    '解散后房间的聊天、队列和 Cookie 都会被删除，确定继续吗？',
    '解散歌房',
    {
      confirmButtonText: '解散',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      await roomStore.dissolve();
      settingsVisible.value = false;
      router.replace('/room');
      loadRooms();
    })
    .catch(() => {});
}

function removeQueue(id: string) {
  roomStore.removeQueue(id);
}

function sendChat() {
  const text = chatText.value.trim();
  if (!text) return;
  roomStore.chat(text);
  chatText.value = '';
}

function resizeChatImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = Math.min(1, 100 / longestSide);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法处理图片');
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.82));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectURL);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('无法读取图片'));
    };
    image.src = objectURL;
  });
}

async function handleChatPaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return;
  let imageFile: File | null = null;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      imageFile = item.getAsFile();
      break;
    }
  }
  if (!imageFile) return;
  event.preventDefault();
  const previewURL = URL.createObjectURL(imageFile);
  try {
    await ElMessageBox.confirm(
      h('img', {
        src: previewURL,
        alt: '待发送图片',
        style:
          'display:block;max-width:70vw;max-height:60vh;object-fit:contain;margin:auto;'
      }),
      '发送图片',
      { confirmButtonText: '发送', cancelButtonText: '取消' }
    );
  } catch {
    URL.revokeObjectURL(previewURL);
    return;
  }
  URL.revokeObjectURL(previewURL);
  try {
    const dataURL = await resizeChatImage(imageFile);
    roomStore.chat('', dataURL);
  } catch (error: any) {
    ElMessage({
      ...messageOption(error?.message || '图片处理失败'),
      type: 'error'
    });
  }
}

function insertEmoji(emoji: string) {
  chatText.value += emoji;
}

function openSearch() {
  searchVisible.value = true;
  searchKeyword.value = '';
  searchMusics.value = [];
  searchPlaylists.value = [];
  playlistMusics.value = [];
  playlistTitle.value = '';
}

async function searchMusic() {
  const key = searchKeyword.value.trim();
  if (!key) return;
  searchLoading.value = true;
  playlistMusics.value = [];
  try {
    if (searchType.value === 'music') {
      const result = await api.search(searchSource.value, key, 0);
      searchMusics.value = result.list;
      searchPlaylists.value = [];
    } else {
      const result = await api.searchPlaylist(searchSource.value, key, 0);
      searchPlaylists.value = result.list;
      searchMusics.value = [];
    }
  } finally {
    searchLoading.value = false;
  }
}

async function openPlaylist(item: PlaylistSearchItem) {
  searchLoading.value = true;
  try {
    const result = await api.playlistDetail(searchSource.value, item.id, 0);
    playlistMusics.value = result.list;
    playlistTitle.value = item.name;
  } finally {
    searchLoading.value = false;
  }
}

function addMusic(music: Music) {
  const queueLengthBeforeAdd = snapshot.value?.state.queue.length || 0;
  const errorBeforeAdd = roomStore.lastError;
  if (!roomStore.connected) {
    ElMessage({
      ...messageOption('正在连接歌房服务，请稍后再试'),
      type: 'warning'
    });
    return;
  }
  roomStore.addQueue(music);
  if (roomStore.lastError && roomStore.lastError !== errorBeforeAdd) {
    ElMessage({ ...messageOption(roomStore.lastError), type: 'error' });
    return;
  }
  let stopQueueWatch = () => {};
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const cleanup = () => {
    stopQueueWatch();
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };
  stopQueueWatch = watch(
    () => snapshot.value?.state.queue.length || 0,
    queueLength => {
      if (queueLength <= queueLengthBeforeAdd) return;
      cleanup();
      ElMessage({
        ...messageOption(`已点歌：${music.name}`),
        type: 'success'
      });
      nextTick(() => {
        const scrollbar = queueScrollbar.value;
        const wrap = scrollbar?.wrapRef;
        if (scrollbar && wrap) scrollbar.setScrollTop(wrap.scrollHeight);
      });
    }
  );
  // A failed or disconnected command should not leave watchers alive forever.
  timeout = setTimeout(cleanup, 5000);
}
let stopSearchWatch = () => {};
let stopRoomWatch = () => {};
let stopErrorWatch = () => {};
onMounted(async () => {
  await roomStore.initialize();
  await openRouteRoom();
  if (!roomStore.room) await loadRooms();
  loaded.value = true;
  clockTimer = setInterval(() => (clock.value = Date.now()), 500);

  stopSearchWatch = watch(keyword, () => {
    page.value = 1;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(loadRooms, 300);
  });
  stopRoomWatch = watch(
    () => route.query.room,
    () => openRouteRoom()
  );
  stopErrorWatch = watch(
    () => roomStore.lastError,
    error => {
      error && ElMessage({ ...messageOption(error), type: 'error' });
      nextTick(() => (roomStore.lastError = ''));
    }
  );
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (clockTimer) clearInterval(clockTimer);
  stopSearchWatch();
  stopRoomWatch();
  stopErrorWatch();
  roomStore.leave();
});
</script>

<template>
  <div class="music-room" v-loading="!loaded || roomStore.loading">
    <template v-if="!isRoomOpen">
      <section class="music-room-lobby music-page-padding">
        <div class="music-room-lobby-header">
          <div class="music-room-lobby-header-title">
            <h1>在线歌房</h1>
            <p>和朋友同步听歌、点歌和聊天</p>
          </div>
          <div class="music-room-lobby-header-operate">
            <el-input
              v-model="keyword"
              clearable
              placeholder="搜索房间名称"
              class="music-room-lobby-search">
              <template #prefix>
                <el-icon> <Search /> </el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="openCreate">创建歌房</el-button>
          </div>
        </div>
        <!-- <p v-if="roomStore.lastError" class="music-room-error">
          {{ roomStore.lastError }}
        </p> -->
        <div class="music-room-cards" v-loading="loadingList">
          <el-empty
            v-if="!loadingList && rooms.length === 0"
            description="还没有歌房，创建第一个吧" />
          <article v-for="item in rooms" :key="item.id" class="music-room-card">
            <div class="music-room-card-title">
              <span class="text-overflow-1">{{ item.name }}</span>
              <span :title="item.locked ? '需要房间密码' : '公开歌房'">
                <el-icon v-if="item.locked"><Lock /></el-icon>
                <el-icon v-else><Unlock /></el-icon>
              </span>
            </div>
            <div class="music-room-card-members">
              {{ item.onlineCount }} / {{ item.maxMembers }} 人在线
            </div>
            <div class="music-room-card-current text-overflow-1">
              正在播放：{{
                item.currentMusic
                  ? `${item.currentMusic.name} · ${item.currentMusic.singer}`
                  : '暂无歌曲'
              }}
            </div>
            <el-button size="small" @click="openJoin(item)">进入房间</el-button>
          </article>
        </div>
        <el-pagination
          v-if="total > (roomStore.config?.listPageSize || 24)"
          v-model:current-page="page"
          :page-size="roomStore.config?.listPageSize || 24"
          layout="prev, pager, next"
          :total="total"
          @current-change="loadRooms" />
      </section>
    </template>

    <template v-else-if="snapshot">
      <section class="music-room-active">
        <header class="music-room-active-header">
          <div class="music-room-active-header-title">
            <span class="music-icon" @click="leaveRoom">左</span>
            <span class="text-overflow-1">{{ snapshot.room.name }}</span>
            <small
              >{{ snapshot.room.locked ? '锁' : '开' }}
              {{ snapshot.room.onlineCount }} /
              {{ snapshot.room.maxMembers }} 人</small
            >
            <span v-if="roomStore.connected" class="music-room-connected"
              >已连接</span
            >
            <span v-else class="music-room-disconnected">重连中</span>
          </div>
          <div class="music-room-active-header-actions">
            <el-button text @click="copyRoomLink">复制链接</el-button>
            <el-button text @click="openSettings">设置</el-button>
            <el-button text @click="leaveRoom">离开</el-button>
          </div>
        </header>
        <!-- <p
          v-if="roomStore.lastError"
          class="music-room-error music-room-active-error">
          {{ roomStore.lastError }}
        </p> -->
        <main class="music-room-active-main">
          <section class="music-room-queue">
            <div class="music-room-panel-title">
              已点歌曲 <small>{{ snapshot.state.queue.length }}</small>
            </div>
            <div v-if="current" class="music-room-current-row">
              <img :src="current.music.image || LogoImage" />
              <div class="text-overflow-1">
                <b>正在播放</b
                ><span
                  >{{ current.music.name }} · {{ current.music.singer }}</span
                >
              </div>
            </div>
            <el-scrollbar ref="queueScrollbar" class="music-room-queue-list">
              <el-empty
                v-if="snapshot.state.queue.length === 0"
                description="还没有人点歌"
                :image-size="80" />
              <div
                v-for="(item, index) in snapshot.state.queue"
                :key="item.id"
                class="music-room-queue-item">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <img :src="item.music.image || LogoImage" />
                <div class="music-room-queue-item-info text-overflow-1">
                  <b class="text-overflow-1">{{ item.music.name }}</b>
                  <small class="text-overflow-1"
                    >{{ item.music.singer }} ·
                    {{ item.requestedName }} 点歌</small
                  >
                </div>
                <div
                  v-if="
                    roomStore.isAdmin || item.requestedBy === snapshot.memberId
                  "
                  class="music-room-queue-item-actions">
                  <span
                    v-if="roomStore.isAdmin"
                    class="music-icon"
                    :title="item.pinned ? '取消置顶' : '置顶'"
                    @click.stop="roomStore.togglePinQueue(item.id)">
                    {{ item.pinned ? '取' : '顶' }}
                  </span>
                  <span
                    class="music-icon"
                    title="删除"
                    @click.stop="removeQueue(item.id)">
                    删
                  </span>
                </div>
              </div>
            </el-scrollbar>
          </section>

          <section class="music-room-control">
            <div class="music-room-player">
              <div class="music-room-player-image">
                <img
                  class="music-room-player-image-disc rotation-animation"
                  :class="
                    roomStore.localPlaying ? 'rotation-animation-running' : ''
                  "
                  src="../assets/images/disc.png" />
                <img
                  class="music-room-player-image-album rotation-animation"
                  :class="
                    roomStore.localPlaying ? 'rotation-animation-running' : ''
                  "
                  :src="
                    current?.music.mediumImage ||
                    current?.music.image ||
                    LogoImage
                  " />
              </div>
              <div class="music-room-player-info">
                <h2 class="text-overflow-1">
                  {{ current?.music.name || '等待点歌' }}
                </h2>
                <p class="text-overflow-1">
                  {{
                    current
                      ? `${current.music.singer} · ${current.music.album || '未知专辑'}`
                      : '所有人都可以点歌'
                  }}
                </p>
                <div class="music-room-player-progress">
                  <span>{{ formatTime(currentPosition()) }}</span>
                  <el-slider
                    :model-value="currentPosition()"
                    :max="playbackLength"
                    :disabled="!roomStore.isAdmin || !current"
                    :show-tooltip="false"
                    @change="roomStore.seek" />
                  <span>{{
                    current?.music.duration || formatTime(playbackLength)
                  }}</span>
                </div>
                <div class="music-room-player-actions">
                  <template v-if="roomStore.isAdmin">
                    <el-button
                      circle
                      :loading="
                        playback?.playing &&
                        !roomStore.localPlaying &&
                        roomStore.syncingAudio
                      "
                      @click="roomStore.togglePlayerAction"
                      ><span
                        v-show="
                          !(
                            playback?.playing &&
                            !roomStore.localPlaying &&
                            roomStore.syncingAudio
                          )
                        "
                        class="music-icon"
                        :title="roomStore.localPlaying ? '暂停' : '播放'">
                        {{ roomStore.localPlaying ? '停' : '播' }}
                      </span>
                    </el-button>
                    <el-button circle @click="roomStore.next"
                      ><span class="music-icon" title="切歌"
                        >后</span
                      ></el-button
                    >
                  </template>
                  <template v-else>
                    <el-button
                      v-if="playback?.playing && !roomStore.localPlaying"
                      circle
                      :loading="roomStore.syncingAudio"
                      :disabled="roomStore.syncingAudio"
                      @click="roomStore.resumeAudio">
                      播
                    </el-button>
                    <span>管理员控制播放 · 你可调整本地音量</span>
                  </template>
                  <span
                    v-if="playback?.playing && !roomStore.localPlaying"
                    class="music-room-player-resume-tip"
                    >点击播放以恢复本地声音</span
                  >
                  <div class="music-room-volume">
                    <span class="music-icon" title="静音">
                      {{ roomStore.volume > 0 ? '音' : '静' }} </span
                    ><el-slider
                      :model-value="roomStore.volume"
                      :show-tooltip="false"
                      @input="roomStore.setVolume" />
                  </div>
                </div>
                <div class="music-room-player-lyric text-overflow-1">
                  {{
                    roomLyricLoading ? '歌词加载中…' : currentRoomLyric || ''
                  }}
                </div>
              </div>
            </div>
            <div class="music-room-chat">
              <div class="music-room-panel-title">聊天</div>
              <el-scrollbar class="music-room-chat-list">
                <p v-for="message in roomStore.chatMessages" :key="message.id">
                  <b
                    :class="{
                      'music-room-chat-self':
                        message.memberId === snapshot.memberId
                    }">
                    {{ message.nickname }} [{{
                      chatMemberId(message.memberId)
                    }}] </b
                  ><span class="music-room-chat-content">
                    <span v-if="message.content">{{ message.content }}</span>
                    <img
                      v-if="message.image"
                      class="music-room-chat-image"
                      :src="message.image"
                      alt="聊天图片" />
                  </span>
                </p>
              </el-scrollbar>
              <div class="music-room-chat-input">
                <el-input
                  v-model="chatText"
                  maxlength="200"
                  placeholder="说点什么…"
                  @keyup.enter="sendChat"
                  @paste="handleChatPaste" />
                <span>
                  <el-popover placement="top-end" :width="290" trigger="click">
                    <div class="music-room-emoji-panel">
                      <button
                        v-for="emoji in emojiList"
                        :key="emoji"
                        type="button"
                        @click="insertEmoji(emoji)">
                        {{ emoji }}
                      </button>
                    </div>
                    <template #reference>
                      <el-button
                        class="music-room-emoji-trigger"
                        title="选择表情"
                        >☺</el-button
                      >
                    </template>
                  </el-popover>
                  <el-button type="primary" @click="sendChat">发送</el-button>
                </span>
              </div>
            </div>
          </section>
        </main>
        <button class="music-room-search-trigger" @click="openSearch">
          <span>♪</span>点歌
        </button>
      </section>
    </template>

    <el-dialog
      v-model="createVisible"
      title="创建歌房"
      width="440px"
      append-to-body>
      <el-form label-position="top">
        <el-form-item label="你的昵称"
          ><el-input
            v-model="nickname"
            maxlength="24"
            placeholder="首次进入后将保存在房间内"
        /></el-form-item>
        <el-form-item label="房间名称"
          ><el-input
            v-model="createForm.name"
            maxlength="30"
            placeholder="例如：周五听歌局"
        /></el-form-item>
        <el-form-item label="进入密码（可选）"
          ><el-input
            v-model="createForm.entryPassword"
            type="password"
            show-password
            placeholder="留空即公开"
        /></el-form-item>
        <el-form-item label="管理员密码"
          ><el-input v-model="createForm.adminPassword" />
          <p class="music-room-dialog-tip">
            知道管理员密码的人都能控制播放、改设置或解散房间。
          </p></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button @click="createVisible = false">取消</el-button
        ><el-button type="primary" @click="createRoom"
          >创建并进入</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="joinVisible"
      title="进入歌房"
      width="400px"
      append-to-body>
      <el-form label-position="top"
        ><el-form-item label="昵称"
          ><el-input v-model="nickname" maxlength="24" /></el-form-item
        ><el-form-item label="房间密码"
          ><el-input
            v-model="joinPassword"
            type="password"
            show-password
            placeholder="公开房间可留空" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="joinVisible = false">取消</el-button
        ><el-button type="primary" @click="joinRoom">进入</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="adminVisible"
      title="管理员权限"
      width="380px"
      append-to-body>
      <p class="music-room-dialog-tip">
        输入管理员密码后，可以控制播放、管理歌曲和修改房间设置。
      </p>
      <el-input
        v-model="adminPassword"
        type="password"
        show-password
        placeholder="管理员密码"
        @keyup.enter="enterAdmin" />
      <template #footer
        ><el-button @click="adminVisible = false">取消</el-button
        ><el-button type="primary" @click="enterAdmin"
          >确认</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="settingsVisible"
      title="房间设置"
      width="560px"
      append-to-body>
      <el-form label-position="top">
        <el-form-item label="房间名称"
          ><el-input v-model="settingsName" maxlength="30"
        /></el-form-item>
        <el-form-item
          ><el-switch v-model="settingsEntryEnabled" />
          <span style="margin-left: 8px">设置进入密码</span></el-form-item
        >
        <el-form-item v-if="settingsEntryEnabled" label="新的进入密码"
          ><el-input
            v-model="settingsEntryPassword"
            type="password"
            show-password
            placeholder="不填写则保持原密码"
        /></el-form-item>
        <el-form-item label="新的管理员密码"
          ><el-input
            v-model="settingsAdminPassword"
            type="password"
            show-password
            placeholder="不填写则保持原密码"
        /></el-form-item>
        <el-divider>音乐源 Cookie</el-divider>
        <p class="music-room-dialog-tip">
          Cookie 仅加密存储在本房间服务端，不会同步给房间成员。
        </p>
        <div
          v-for="source in musicSources"
          :key="source"
          class="music-room-cookie-row">
          <b>{{
            source === 'cloud'
              ? '网易云'
              : source === 'qq'
                ? 'QQ 音乐'
                : '咪咕音乐'
          }}</b>
          <span>{{
            snapshot?.credentialSources.includes(source) ? '已配置' : '未配置'
          }}</span>
          <el-input
            v-model="cookieValues[source]"
            type="password"
            show-password
            placeholder="粘贴 Cookie" />
          <el-button
            :disabled="
              !cookieValues[source] ||
              !roomStore.config?.credentialUploadEnabled
            "
            @click="uploadCookie(source)"
            >保存</el-button
          >
          <el-button
            v-if="snapshot?.credentialSources.includes(source)"
            text
            type="danger"
            @click="removeCookie(source)"
            >移除</el-button
          >
        </div>
      </el-form>
      <template #footer
        ><el-button type="danger" plain @click="dissolveRoom"
          >解散房间</el-button
        ><el-button @click="settingsVisible = false">取消</el-button
        ><el-button type="primary" @click="saveSettings"
          >保存设置</el-button
        ></template
      >
    </el-dialog>

    <el-drawer
      v-model="searchVisible"
      direction="rtl"
      size="min(520px, 100%)"
      :with-header="false"
      append-to-body
      class="music-room-search-drawer">
      <div class="music-room-search-head">
        <h2>{{ playlistTitle || '点歌' }}</h2>
        <span class="music-icon" @click="searchVisible = false">关</span>
      </div>
      <div v-if="!playlistTitle" class="music-room-search-input">
        <MusicTypeEle :value="searchSource" @change="v => (searchSource = v)" />
        <el-input
          v-model="searchKeyword"
          placeholder="搜索歌曲或歌单"
          @keyup.enter="searchMusic"
          style="flex: 1">
          <template #suffix>
            <el-icon @click="searchMusic" style="cursor: pointer">
              <Search />
            </el-icon>
          </template>
        </el-input>
        <!-- <div class="music-room-search-switch">
          <el-radio-group v-model="searchType">
            <el-radio-button value="music">歌曲</el-radio-button>
            <el-radio-button value="playlist">歌单</el-radio-button>
          </el-radio-group>
        </div> -->
      </div>
      <el-scrollbar class="music-room-search-results" v-loading="searchLoading">
        <div
          v-for="music in playlistTitle ? playlistMusics : searchMusics"
          :key="music.type + music.id"
          class="music-room-search-music">
          <img :src="music.image || LogoImage" />
          <div class="text-overflow-1">
            <b class="text-overflow-1">{{ music.name }}</b
            ><span class="text-overflow-1"
              >{{ music.singer }} · {{ music.album }}</span
            >
          </div>
          <el-button size="small" @click="addMusic(music)">点歌</el-button>
        </div>
        <div
          v-for="item in searchPlaylists"
          :key="item.type + item.id"
          class="music-room-search-music">
          <img :src="item.image || LogoImage" />
          <div class="text-overflow-1">
            <b class="text-overflow-1">{{ item.name }}</b
            ><span>{{ item.creator }} · {{ item.trackCount }} 首</span>
          </div>
          <el-button size="small" @click="openPlaylist(item)">查看</el-button>
        </div>
      </el-scrollbar>
    </el-drawer>
  </div>
</template>

<style lang="less" scoped>
.music-room {
  height: 100%;
  color: var(--music-text-color);
  .music-icon {
    cursor: pointer;
  }
  &-error {
    color: var(--el-color-danger);
    margin: 10px 0;
  }
  &-lobby {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0 20px;
    &-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 30px 0 20px;
      h1 {
        margin: 0;
        font-size: 28px;
        display: inline-flex;
      }
      p {
        opacity: 0.6;
        margin: 8px 0 0;
        display: inline-block;
        margin-left: 8px;
      }
      &-operate {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    }
    &-search {
      height: 37px;
      font-size: 14px;
    }
  }
  &-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin: 25px 0;
    flex: 1;
    height: 0;
    overflow: auto;
  }
  &-card {
    background: var(--music-side-background);
    border: 1px solid var(--music-side-divider-color);
    border-radius: var(--music-border-radius);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 11px;
    height: 180px;
    transition: transform 0.2s;
    &:hover {
      transform: translateY(-2px);
    }
    &-title {
      font-weight: bold;
      font-size: 17px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    &-members,
    &-current {
      font-size: 13px;
      opacity: 0.65;
    }
    button {
      margin-top: auto;
      align-self: flex-end;
    }
  }
  &-active {
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    &-header {
      height: 64px;
      flex-shrink: 0;
      padding: 0 var(--music-page-padding-horizontal);
      border-bottom: 1px solid var(--music-side-divider-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      &-title {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: bold;
        > span:nth-child(2) {
          max-width: 300px;
        }
        small {
          font-weight: normal;
          opacity: 0.6;
          white-space: nowrap;
        }
      }
      &-actions {
        display: flex;
        white-space: nowrap;
      }
    }
    &-main {
      flex: 1;
      height: 0;
      display: grid;
      grid-template-columns: minmax(310px, 39%) 1fr;
    }
    &-error {
      padding: 0 var(--music-page-padding-horizontal);
    }
  }
  &-connected,
  &-disconnected {
    padding: 3px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: normal;
  }
  &-connected {
    background: #67c23a22;
    color: #67c23a;
  }
  &-disconnected {
    background: #e6a23c22;
    color: #e6a23c;
  }
  &-queue {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--music-side-divider-color);
    &-list {
      flex: 1;
    }
  }
  &-panel-title {
    font-size: 17px;
    font-weight: bold;
    padding: 18px 20px;
    small {
      font-size: 12px;
      opacity: 0.6;
    }
  }
  &-current-row,
  &-queue-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 20px;
    img {
      width: 42px;
      height: 42px;
      border-radius: var(--music-border-radius);
      object-fit: cover;
    }
    &:hover {
      background-color: var(--music-background-hover);
      // border-radius: var(--music-border-radius);
    }
  }
  &-current-row {
    background: var(--music-button-info-border-color);
    > div {
      min-width: 0;
      display: flex;
      flex-direction: column;
      b {
        font-size: 11px;
        color: var(--music-primary-color);
      }
      span {
        font-size: 13px;
      }
    }
  }
  &-queue-item {
    > span:first-child {
      width: 22px;
      font-size: 12px;
      opacity: 0.5;
    }
    &:hover &-actions,
    &:focus-within &-actions {
      opacity: 1;
    }
    &-info {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      b,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      small {
        opacity: 0.6;
        margin-top: 3px;
      }
    }
    &-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      opacity: 0;
      transition: opacity 0.15s ease;
      .music-icon {
        cursor: pointer;
        opacity: 0.75;
        user-select: none;
      }
      .music-icon:hover {
        opacity: 1;
      }
    }
  }
  &-control {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  &-player {
    padding: 26px;
    display: flex;
    align-items: center;
    gap: 26px;
    height: 220px;
    border-bottom: 1px solid var(--music-side-divider-color);
    &-image {
      width: 180px;
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      img {
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 8px 30px #0003;
      }
      &-disc {
        position: absolute;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        object-fit: cover;
      }
      &-album {
        width: 120px;
        height: 120px;
      }
    }
    &-info {
      height: 180px;
      flex: 1;
      h2 {
        margin: 0;
        font-size: 23px;
      }
      p {
        opacity: 0.6;
      }
    }
    &-lyric {
      margin-top: 18px;
      min-height: 20px;
      color: var(--music-primary-color);
      font-size: 13px;
      opacity: 0.9;
    }
    &-progress {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      opacity: 0.8;
      .el-slider {
        flex: 1;
      }
    }
    &-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 18px;
      > span {
        opacity: 0.6;
        font-size: 13px;
      }
      .el-button {
        width: 37px;
        .music-icon {
          margin-right: 0;
        }
      }
    }
  }
  &-volume {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 160px;
    .el-slider {
      flex: 1;
    }
  }
  &-chat {
    height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    &-list {
      flex: 1;
      padding: 0 20px;
      p {
        margin: 0 0 10px;
        display: flex;
        gap: 8px;
        font-size: 13px;
        b {
          opacity: 0.75;
          flex-shrink: 0;
        }
        .music-room-chat-self {
          color: var(--music-primary-color);
          opacity: 1;
        }
        span {
          word-break: break-word;
        }
        .music-room-chat-content {
          min-width: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
        }
        .music-room-chat-image {
          display: block;
          width: auto;
          max-width: 100px;
          max-height: 100px;
          border-radius: 6px;
          object-fit: contain;
        }
      }
    }
    &-input {
      display: flex;
      padding: 12px 20px 16px;
      gap: 10px;
      align-items: center;
      .el-input {
        min-width: 0;
        flex: 1;
        height: 37px;
      }
    }
  }
  &-emoji-trigger {
    flex-shrink: 0;
    padding: 8px 10px;
    font-size: 18px;
  }
  &-emoji-panel {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    button {
      border: 0;
      border-radius: 6px;
      padding: 5px 0;
      background: transparent;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    button:hover {
      background: var(--music-button-info-border-color);
    }
  }
  &-search-trigger {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    border: 0;
    padding: 15px 10px;
    border-radius: 12px 0 0 12px;
    background: var(--music-button-primary-background);
    color: white;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    box-shadow: 0 4px 16px #0003;
    cursor: pointer;
  }
  &-dialog-tip {
    margin: 6px 0 0;
    line-height: 1.5;
    font-size: 12px;
    opacity: 0.65;
  }
  &-cookie-row {
    display: grid;
    grid-template-columns: 70px 50px 1fr auto auto;
    gap: 8px;
    align-items: center;
    margin: 10px 0;
    font-size: 12px;
  }
  &-search-head {
    padding: 0 20px;
    height: 62px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    h2 {
      margin: 0;
    }
  }
  &-search-switch {
    display: flex;
    justify-content: space-between;
    margin: 14px 0;
    gap: 8px;
    flex-wrap: wrap;
  }
  &-search-results {
    height: calc(100% - 125px);
    padding: 0 20px;
  }
  &-search-input {
    display: flex;
    gap: 8px;
    padding: 0 20px;
    :deep(.el-radio-group) {
      margin-left: 0;
    }
  }
  &-search-music {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 2px;
    border-bottom: 1px solid var(--music-side-divider-color);
    img {
      width: 45px;
      height: 45px;
      object-fit: cover;
      border-radius: var(--music-border-radius);
    }
    > div {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      b,
      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      span {
        opacity: 0.6;
        font-size: 12px;
      }
    }
  }
}
:global(.music-room-search-drawer .el-drawer__body) {
  padding: 20px 0;
}
@media (max-width: 850px) {
  .music-room {
    &-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    &-active-main {
      grid-template-columns: 1fr;
      overflow: auto;
    }
    &-queue {
      min-height: 300px;
      border-right: 0;
      border-bottom: 1px solid var(--music-side-divider-color);
    }
    &-control {
      min-height: 550px;
    }
    &-active {
      height: auto;
      min-height: 100%;
    }
    &-active-header {
      padding: 0 14px;
      &-title > span:nth-child(2) {
        max-width: 130px;
      }
    }
  }
}
@media (max-width: 520px) {
  .music-room {
    &-cards {
      grid-template-columns: 1fr;
    }
    &-lobby {
      padding: 0 16px;
      &-header-operate {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      &-header-title {
        p {
          margin-left: 0;
        }
      }
    }
    &-player {
      padding: 20px;
      gap: 15px;
      &-image {
        width: 100px;
        height: 100px;
        &-album {
          width: 70px;
          height: 70px;
        }
        &-disc {
          width: 100px;
          height: 100px;
        }
      }
    }
    &-volume {
      width: 100px;
    }
    &-active-header-actions button:first-child {
      display: none;
    }
    &-cookie-row {
      grid-template-columns: 60px 45px 1fr auto;
      .el-button:last-child {
        grid-column: 3/5;
      }
    }
  }
}
</style>
