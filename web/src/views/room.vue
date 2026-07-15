<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowDown,
  CloseBold,
  DeleteFilled,
  EditPen,
  Lock,
  Search,
  Setting,
  Share,
  Unlock,
  Upload
} from '@element-plus/icons-vue';
import { currentRoomKey, useRoomStore } from '../stores/room';
import { usePlayStore } from '../stores/play';
import { useSettingStore } from '../stores/setting';
import * as api from '../utils/api/api';
import MusicTypeEle from '../components/MusicType.vue';
import { RankingType } from '../utils/type';
import type {
  LyricLine,
  Music,
  MusicType,
  Playlist,
  PlaylistSearchItem
} from '../utils/type';
import { LogoImage } from '../utils/logo';
import { RoomRequestError } from '../utils/room';
import {
  messageOption,
  millisecond2Duration,
  parseLyric
} from '../utils/utils';

const roomStore = useRoomStore();
const playStore = usePlayStore();
const settingStore = useSettingStore();
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

function clearRoomEntryPassword(roomId: string) {
  const credentials = readRoomCredentials();
  const credential = credentials[roomId];
  if (!credential) return;
  credentials[roomId] = { ...credential, entryPassword: '' };
  localStorage.setItem(roomCredentialsKey, JSON.stringify(credentials));
}

function cachedRoomCredentialIds() {
  return Object.keys(readRoomCredentials());
}

function removeRoomCredentialCache(roomIds: string[]) {
  const removed = new Set(roomIds.map(roomId => String(roomId).toUpperCase()));
  const credentials = readRoomCredentials();
  let changed = false;
  for (const roomId of Object.keys(credentials)) {
    if (!removed.has(roomId.toUpperCase())) continue;
    delete credentials[roomId];
    changed = true;
  }
  if (!changed) return;
  if (Object.keys(credentials).length === 0)
    localStorage.removeItem(roomCredentialsKey);
  else localStorage.setItem(roomCredentialsKey, JSON.stringify(credentials));
}

function isEntryPasswordError(error: any) {
  return error?.message === '房间密码错误';
}

function isRoomRequestStatus(error: unknown, status: number) {
  return error instanceof RoomRequestError && error.status === status;
}

function clearMissingRoomCache(roomId: string) {
  if (localStorage.getItem(currentRoomKey) === roomId)
    localStorage.removeItem(currentRoomKey);
  removeRoomCredentialCache([roomId]);
  roomStore.removeAdminTokenCache([roomId]);
}

const rooms = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref('');
const loaded = ref(false);
const createVisible = ref(false);
const joinVisible = ref(false);
const nicknameVisible = ref(false);
const adminVisible = ref(false);
const settingsVisible = ref(false);
const searchVisible = ref(false);
const targetRoomId = ref('');
const loadingList = ref(false);
const routeRoomLoading = ref(false);
const createLoading = ref(false);
const joinLoading = ref(false);
const nicknameLoading = ref(false);
const adminLoading = ref(false);
const settingsLoading = ref(false);
const dissolveLoading = ref(false);
const clock = ref(Date.now());
const chatText = ref('');
const nickname = ref(localStorage.getItem('musiche-room-nickname') || '');
const roomNickname = ref('');
const joinPassword = ref('');
const adminPassword = ref('');
const createForm = ref({ name: '', entryPassword: '', adminPassword: '' });
const settingsName = ref('');
const settingsEntryEnabled = ref(false);
const settingsEntryPassword = ref('');
const settingsAdminPassword = ref('');
const settingsGuestQueueEnabled = ref(true);
const updatingCookieSource = ref<MusicType | ''>('');
const searchKeyword = ref('');
const searchSource = ref<MusicType>('cloud');
const searchType = ref<'music' | 'playlist'>('music');
const searchLoading = ref(false);
const searchMusics = ref<Music[]>([]);
type RoomPlaylistItem = PlaylistSearchItem & { musicList?: Music[] };
type ShortcutKey = 'recommend' | 'ranking' | 'lover' | 'favorites' | 'created';
const searchPlaylists = ref<RoomPlaylistItem[]>([]);
const playlistMusics = ref<Music[]>([]);
const playlistTitle = ref('');
const activeShortcut = ref<ShortcutKey | ''>('');
const shortcutOptions: Array<{
  value: ShortcutKey;
  label: string;
  icon: string;
}> = [
  { value: 'recommend', label: '发现音乐', icon: '荐' },
  { value: 'ranking', label: '音乐榜单', icon: '顶' },
  { value: 'lover', label: '我喜欢的音乐', icon: '爱' },
  { value: 'favorites', label: '收藏的歌单', icon: '藏' },
  { value: 'created', label: '创建的歌单', icon: '编' }
];
const queueScrollbar = ref<any>(null);
const chatScrollbar = ref<any>(null);
const chatShouldStickToBottom = ref(true);
const unreadChatCount = ref(0);
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

watch(
  () => musicSources.map(source => settingStore.userInfo[source]?.id || ''),
  () => {
    if (roomStore.isAdmin) void roomStore.syncAdminCookies();
  }
);

const snapshot = computed(() => roomStore.snapshot);
const current = computed(() => snapshot.value?.state.current || null);
const playback = computed(() => snapshot.value?.state.playback);
const playbackLength = computed(() => current.value?.music.length || 1);
const isRoomOpen = computed(() => Boolean(snapshot.value));
const progressDragging = ref(false);
const progressModelValue = ref(0);
const playLoading = computed(
  () =>
    playback.value?.playing && !roomStore.localPlaying && roomStore.syncingAudio
);
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
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}

function currentPosition() {
  return Math.min(
    playbackLength.value,
    Math.max(0, roomStore.currentPosition(clock.value))
  );
}

function changeProgress(value: number) {
  progressDragging.value = false;
  roomStore.seek(value);
}

watch(
  () => [
    clock.value,
    current.value?.id,
    playback.value?.positionMs,
    playback.value?.updatedAt
  ],
  () => {
    if (!progressDragging.value) progressModelValue.value = currentPosition();
  },
  { immediate: true }
);

function formatTime(value: number) {
  return millisecond2Duration(Math.round(value || 0));
}

function chatMemberId(memberId: string) {
  return String(memberId || '')
    .slice(-4)
    .toUpperCase();
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(item => String(item).padStart(2, '0'))
    .join(':');
}

const chatAvatarCache = new Map<string, string>();
function chatAvatar(memberId: string) {
  const key = String(memberId || 'guest');
  const cached = chatAvatarCache.get(key);
  if (cached) return cached;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsignedHash = hash >>> 0;
  const hue = unsignedHash % 360;
  const accentHue = (hue + 70 + ((unsignedHash >>> 8) % 80)) % 360;
  const circleX = 16 + ((unsignedHash >>> 16) % 32);
  const circleY = 16 + ((unsignedHash >>> 22) % 32);
  const circleRadius = 8 + ((unsignedHash >>> 27) % 10);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 72% 58%)"/><stop offset="1" stop-color="hsl(${accentHue} 72% 42%)"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><circle cx="${circleX}" cy="${circleY}" r="${circleRadius}" fill="white" opacity=".72"/><path d="M0 48 Q18 30 34 48 T64 42 V64 H0Z" fill="hsl(${accentHue} 70% 30%)" opacity=".65"/><circle cx="48" cy="16" r="7" fill="white" opacity=".28"/></svg>`;
  const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  chatAvatarCache.set(key, dataURL);
  return dataURL;
}

function updateChatScrollPosition() {
  const wrap = chatScrollbar.value?.wrapRef as HTMLElement | undefined;
  if (!wrap) return;
  // Keep automatic scrolling enabled while the user is reading the latest
  // messages, but do not pull them away from older messages they selected.
  chatShouldStickToBottom.value =
    wrap.scrollHeight - wrap.clientHeight - wrap.scrollTop <= 48;
  if (chatShouldStickToBottom.value) unreadChatCount.value = 0;
}

function scrollChatToBottom(force = false, smooth = false) {
  if (!force && !chatShouldStickToBottom.value) return;
  nextTick(() => {
    if (!force && !chatShouldStickToBottom.value) return;
    const scrollbar = chatScrollbar.value;
    const wrap = scrollbar?.wrapRef as HTMLElement | undefined;
    if (!scrollbar || !wrap) return;
    if (smooth) wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
    else scrollbar.setScrollTop(wrap.scrollHeight);
    chatShouldStickToBottom.value = true;
    unreadChatCount.value = 0;
  });
}

function followLatestChat() {
  chatShouldStickToBottom.value = true;
  scrollChatToBottom(true, true);
}

function handleChatImageLoad() {
  // An image changes the item height only after it loads, so align once more
  // when the user was already following the newest messages.
  scrollChatToBottom();
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
    } catch (error) {
      console.warn('[在线歌房] 歌词加载失败', error);
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
    await cleanupRoomCaches(result.items);
  } catch (error: any) {
    roomStore.lastError;
    const err = error?.message || '无法加载歌房列表';
    ElMessage(messageOption(err));
  } finally {
    loadingList.value = false;
  }
}

async function cleanupRoomCaches(currentPageRooms: Array<{ id: string }>) {
  const currentPageIds = new Set(
    currentPageRooms.map(room => String(room.id).toUpperCase())
  );
  const cachedRoomIds = new Set([
    ...cachedRoomCredentialIds(),
    ...roomStore.cachedAdminTokenRoomIds()
  ]);
  const idsToCheck = [...cachedRoomIds].filter(
    roomId => !currentPageIds.has(String(roomId).toUpperCase())
  );
  if (idsToCheck.length === 0) return;
  try {
    const missingRoomIds = await roomStore.missingRoomIds(idsToCheck);
    removeRoomCredentialCache(missingRoomIds);
    roomStore.removeAdminTokenCache(missingRoomIds);
  } catch (error) {
    // Cache cleanup is best-effort. Never delete local credentials when the
    // server could not verify which cached rooms have been dissolved.
    console.warn('[在线歌房] 清理已解散房间缓存失败', error);
  }
}

async function cleanupRoomCachesFromFirstPage() {
  try {
    const result = await roomStore.list('', 1);
    await cleanupRoomCaches(result.items);
  } catch (error) {
    console.warn('[在线歌房] 获取房间列表以清理本地缓存失败', error);
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

async function pauseOriginalPlayer() {
  if (!playStore.playStatus.playing) return;
  try {
    await playStore.pause();
  } catch {
    // Entering a room should not be blocked if the original player is already
    // unavailable; the room player can still continue to synchronize.
  }
}

async function createRoom() {
  if (!nickname.value.trim()) {
    ElMessage(messageOption('请先填写昵称'));
    return;
  }
  createLoading.value = true;
  try {
    await roomStore.create({ ...createForm.value, nickname: nickname.value });
    await pauseOriginalPlayer();
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
  } finally {
    createLoading.value = false;
  }
}

async function openJoin(room: any) {
  targetRoomId.value = room.id;
  const saved = getRoomCredential(room.id);
  if (saved) {
    nickname.value = saved.nickname;
    joinPassword.value = saved.entryPassword;
    routeRoomLoading.value = true;
    try {
      await joinRoom({ automatic: true });
    } finally {
      routeRoomLoading.value = false;
    }
    return;
  }
  joinPassword.value = '';
  joinVisible.value = true;
}

async function joinRoom(options: { automatic?: boolean } = {}) {
  if (!nickname.value.trim()) {
    if (!options.automatic) ElMessage(messageOption('请先填写昵称'));
    return false;
  }
  joinLoading.value = true;
  try {
    await roomStore.join(targetRoomId.value, {
      nickname: nickname.value,
      entryPassword: joinPassword.value
    });
    await pauseOriginalPlayer();
    localStorage.setItem('musiche-room-nickname', nickname.value.trim());
    saveRoomCredential(targetRoomId.value, {
      nickname: nickname.value,
      entryPassword: joinPassword.value
    });
    joinVisible.value = false;
    router.replace('/room');
    return true;
  } catch (error: any) {
    if (options.automatic && isEntryPasswordError(error)) {
      clearRoomEntryPassword(targetRoomId.value);
      joinPassword.value = '';
      joinVisible.value = true;
    } else {
      ElMessage(messageOption(error?.message || '进入歌房失败'));
    }
    return false;
  } finally {
    joinLoading.value = false;
  }
}

async function openRouteRoom() {
  const id = typeof route.query.room === 'string' ? route.query.room : '';
  if (!id || roomStore.room?.id === id) return;
  routeRoomLoading.value = true;
  try {
    await roomStore.open(id);
    await pauseOriginalPlayer();
  } catch (error) {
    if (isRoomRequestStatus(error, 404)) {
      clearMissingRoomCache(id);
      ElMessage(messageOption('房间不存在或已解散'));
      await router.replace('/room');
      return;
    }
    const saved = getRoomCredential(id);
    let savedPasswordRejected = false;
    if (saved) {
      nickname.value = saved.nickname;
      joinPassword.value = saved.entryPassword;
      try {
        await roomStore.join(id, saved);
        await pauseOriginalPlayer();
        localStorage.setItem('musiche-room-nickname', saved.nickname);
        return;
      } catch (error: any) {
        if (isRoomRequestStatus(error, 404)) {
          clearMissingRoomCache(id);
          ElMessage(messageOption('房间不存在或已解散'));
          await router.replace('/room');
          return;
        }
        if (isEntryPasswordError(error)) {
          clearRoomEntryPassword(id);
          savedPasswordRejected = true;
        }
        // Ask for updated credentials below.
      }
    }
    targetRoomId.value = id;
    joinPassword.value = savedPasswordRejected
      ? ''
      : saved?.entryPassword || '';
    joinVisible.value = true;
  } finally {
    routeRoomLoading.value = false;
  }
}

async function enterAdmin() {
  adminLoading.value = true;
  try {
    await roomStore.becomeAdmin(adminPassword.value);
    adminPassword.value = '';
    adminVisible.value = false;
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '管理员密码错误'));
  } finally {
    adminLoading.value = false;
  }
}

function openNicknameDialog() {
  roomNickname.value = roomStore.snapshot?.nickname || nickname.value;
  nicknameVisible.value = true;
}

async function saveNickname() {
  const value = roomNickname.value.trim();
  if (!value) {
    ElMessage(messageOption('请填写昵称'));
    return;
  }
  nicknameLoading.value = true;
  try {
    await roomStore.updateNickname(value);
    nickname.value = value;
    localStorage.setItem('musiche-room-nickname', value);
    if (roomStore.room) {
      const saved = getRoomCredential(roomStore.room.id);
      saveRoomCredential(roomStore.room.id, {
        nickname: value,
        entryPassword: saved?.entryPassword || ''
      });
    }
    nicknameVisible.value = false;
    ElMessage(messageOption('昵称已更新'));
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '昵称更新失败'));
  } finally {
    nicknameLoading.value = false;
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
  settingsGuestQueueEnabled.value = roomStore.snapshot?.allowGuestQueue ?? true;
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
  settingsLoading.value = true;
  try {
    await roomStore.updateSettings({
      name: settingsName.value,
      entryPassword: settingsEntryEnabled.value
        ? settingsEntryPassword.value || undefined
        : '',
      adminPassword: settingsAdminPassword.value || undefined,
      allowGuestQueue: settingsGuestQueueEnabled.value
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
  } finally {
    settingsLoading.value = false;
  }
}

function hasLocalCookie(source: (typeof musicSources)[number]) {
  const account = settingStore.userInfo[source];
  return Boolean(account?.id && roomStore.getLocalCookie(source));
}

async function updateCookie(source: (typeof musicSources)[number]) {
  if (!hasLocalCookie(source)) {
    ElMessage(messageOption('请先前往左下角设置登录该音乐平台'));
    return;
  }
  updatingCookieSource.value = source;
  try {
    await roomStore.uploadCookie(source, roomStore.getLocalCookie(source));
    ElMessage(messageOption('Cookie 已更新到服务端'));
  } catch (error: any) {
    ElMessage(messageOption(error?.message || 'Cookie 更新失败'));
  } finally {
    updatingCookieSource.value = '';
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
      dissolveLoading.value = true;
      try {
        await roomStore.dissolve();
        settingsVisible.value = false;
        router.replace('/room');
        loadRooms();
      } catch (error: any) {
        ElMessage(messageOption(error?.message || '解散房间失败'));
      } finally {
        dissolveLoading.value = false;
      }
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
        const scale = Math.min(1, 200 / longestSide);
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

function filterRoomMusic(list: Music[]) {
  return list.filter(music => music.type !== 'local');
}

function toRoomPlaylistItem(playlist: Playlist): RoomPlaylistItem {
  const musicList = playlist.musicList || [];
  return {
    id: String(playlist.id),
    name: playlist.name,
    image: musicList[0]?.image || playlist.image || '',
    type: playlist.type,
    trackCount: filterRoomMusic(musicList).length,
    playCount: 0,
    bookCount: 0,
    creator: '',
    creatorId: '',
    description: playlist.description || '',
    musicList
  };
}

async function searchMusic() {
  const key = searchKeyword.value.trim();
  if (!key) return;
  activeShortcut.value = '';
  searchLoading.value = true;
  playlistMusics.value = [];
  try {
    if (searchType.value === 'music') {
      const result = await api.search(searchSource.value, key, 0);
      searchMusics.value = filterRoomMusic(result.list);
      searchPlaylists.value = [];
    } else {
      const result = await api.searchPlaylist(searchSource.value, key, 0);
      searchPlaylists.value = result.list;
      searchMusics.value = [];
    }
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '搜索失败'));
  } finally {
    searchLoading.value = false;
  }
}

function refreshSearchAfterSwitch() {
  if (searchKeyword.value.trim()) {
    void searchMusic();
    return;
  }
  searchMusics.value = [];
  searchPlaylists.value = [];
}

function changeSearchSource(value: MusicType) {
  searchSource.value = value;
  if (searchKeyword.value.trim()) {
    activeShortcut.value = '';
    void searchMusic();
  } else if (activeShortcut.value) {
    void loadShortcut(activeShortcut.value);
  } else {
    refreshSearchAfterSwitch();
  }
}

function changeSearchType(value: 'music' | 'playlist') {
  searchType.value = value;
  activeShortcut.value = '';
  refreshSearchAfterSwitch();
}

async function openPlaylist(item: RoomPlaylistItem) {
  if (item.type === 'local') {
    playlistMusics.value = filterRoomMusic(item.musicList || []);
    playlistTitle.value = item.name;
    return;
  }
  searchLoading.value = true;
  try {
    const result = await api.playlistDetail(item.type, String(item.id), 0);
    playlistMusics.value = filterRoomMusic(result.list);
    playlistTitle.value = item.name;
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '歌单加载失败'));
  } finally {
    searchLoading.value = false;
  }
}

async function loadShortcut(value: ShortcutKey) {
  activeShortcut.value = value;
  playlistTitle.value = '';
  playlistMusics.value = [];
  searchMusics.value = [];
  searchPlaylists.value = [];

  if (value === 'lover') {
    playlistTitle.value = '我喜欢的音乐';
    playlistMusics.value = filterRoomMusic(playStore.myLoves);
    return;
  }

  searchType.value = 'playlist';
  searchLoading.value = true;
  try {
    let playlists: Playlist[] = [];
    switch (value) {
      case 'recommend':
        playlists = (await api.recommend(searchSource.value, 0)).list;
        break;
      case 'ranking':
        playlists = [RankingType.Hot, RankingType.New, RankingType.Soar]
          .map(ranking => api.rankingPlaylist(searchSource.value, ranking))
          .filter((playlist): playlist is Playlist => Boolean(playlist));
        break;
      case 'favorites':
        playlists = playStore.myFavorites;
        break;
      case 'created':
        playlists = playStore.myPlaylists;
        break;
    }
    searchPlaylists.value = playlists.map(toRoomPlaylistItem);
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '快捷歌单加载失败'));
  } finally {
    searchLoading.value = false;
  }
}

function backToPlaylistSearch() {
  playlistTitle.value = '';
  playlistMusics.value = [];
}

function openSearchDrawer() {
  backToPlaylistSearch();
  searchVisible.value = true;
}

function closeSearchDrawer() {
  if (playlistTitle.value) {
    backToPlaylistSearch();
    return;
  }
  searchVisible.value = false;
  backToPlaylistSearch();
}

function addMusic(music: Music) {
  if (!roomStore.isAdmin && snapshot.value?.allowGuestQueue === false) {
    ElMessage({
      ...messageOption('管理员已关闭游客点歌'),
      type: 'warning'
    });
    return;
  }
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

function startPlayCheck() {
  // Browsers may block an audio element created after a page refresh until a
  // real user gesture occurs.  The room playback state remains authoritative,
  // so only resume the local audio here; never toggle the room's playback.
  const playback = snapshot.value?.state.playback;
  if (!playback?.playing) return;
  if (roomStore.localPlaying && !roomStore.audioNeedsGesture) return;

  void roomStore.resumeAudio().catch(error => {
    console.warn('[在线歌房] 用户手势恢复播放失败', error);
  });
}

const musicCollapsedClass = 'music-aside-collapsed';

function setBodyClass(set?: boolean) {
  if (set) {
    !document.body.className.includes(musicCollapsedClass) &&
      document.body.classList.add(musicCollapsedClass);
  } else {
    document.body.classList.remove(musicCollapsedClass);
  }
}

let stopSearchWatch = () => {};
let stopRoomWatch = () => {};
let stopErrorWatch = () => {};
let stopGuestQueueWatch = () => {};
let stopChatWatch = () => {};
onMounted(async () => {
  setBodyClass(true);
  try {
    await roomStore.initialize();
    const roomId = localStorage.getItem(currentRoomKey);
    if (roomId) {
      try {
        await roomStore.open(roomId);
      } catch (error: any) {
        if (isRoomRequestStatus(error, 404)) {
          clearMissingRoomCache(roomId);
        } else if (isRoomRequestStatus(error, 403)) {
          // The room still exists, but this browser is no longer a recognized
          // member. Keep its saved nickname/password so it can join again.
          localStorage.removeItem(currentRoomKey);
        } else {
          ElMessage(messageOption(error?.message || '进入歌房失败'));
        }
      }
    }
    if (roomStore.room) await pauseOriginalPlayer();
    await openRouteRoom();
    if (!roomStore.room) await loadRooms();
    else await cleanupRoomCachesFromFirstPage();
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '在线歌房初始化失败'));
  } finally {
    loaded.value = true;
  }
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
  stopGuestQueueWatch = watch(
    () => roomStore.snapshot?.allowGuestQueue,
    allowGuestQueue => {
      if (allowGuestQueue === false && !roomStore.isAdmin) {
        searchVisible.value = false;
      }
    }
  );
  stopChatWatch = watch(
    () => roomStore.chatMessages.length,
    (length, previousLength) => {
      if (length === 0) {
        unreadChatCount.value = 0;
        return;
      }
      if (length <= previousLength) return;
      if (chatShouldStickToBottom.value) scrollChatToBottom();
      else unreadChatCount.value += length - previousLength;
    },
    { flush: 'post' }
  );
});

onUnmounted(() => {
  setBodyClass(false);
  if (searchTimer) clearTimeout(searchTimer);
  if (clockTimer) clearInterval(clockTimer);
  stopSearchWatch();
  stopRoomWatch();
  stopErrorWatch();
  stopGuestQueueWatch();
  stopChatWatch();
  roomStore.leave();
});
</script>

<template>
  <div
    class="music-room"
    v-loading="!loaded || roomStore.loading || routeRoomLoading">
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
        <div
          class="music-room-cards"
          v-loading="loadingList"
          :style="
            !loadingList && rooms.length === 0
              ? 'grid-template-columns: none;'
              : ''
          ">
          <el-empty
            v-if="!loadingList && rooms.length === 0"
            description="还没有歌房，创建第一个吧">
            <template #description>
              <el-button type="primary" @click="openCreate"
                >创建歌房</el-button
              ></template
            >
          </el-empty>
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
              {{
                item.currentMusic
                  ? `正在播放：${item.currentMusic.name} · ${item.currentMusic.singer}`
                  : '暂无歌曲'
              }}
            </div>
            <el-button type="primary" size="small" @click="openJoin(item)"
              >进入房间</el-button
            >
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
      <section class="music-room-active" @click="startPlayCheck">
        <header class="music-room-active-header">
          <div class="music-room-active-header-title">
            <span class="music-icon" @click="leaveRoom">左</span>
            <span class="text-overflow-1">{{ snapshot.room.name }}</span>
            <small>
              <el-icon v-if="snapshot.room.locked"><Lock /></el-icon>
              <el-icon v-else><Unlock /></el-icon>
              {{ snapshot.room.onlineCount }} /
              {{ snapshot.room.maxMembers }} 人</small
            >
            <span v-if="roomStore.connected" class="music-room-connected"
              >已连接</span
            >
            <span v-else class="music-room-disconnected">
              {{ roomStore.transportFailureCode ? '连接失败' : '重连中' }}
            </span>
          </div>
          <div class="music-room-active-header-actions">
            <el-button :icon="Share" type="success" @click="copyRoomLink"
              >分享</el-button
            >
            <el-button :icon="Setting" @click="openSettings">设置</el-button>
            <el-button type="warning" :icon="CloseBold" @click="leaveRoom"
              >离开</el-button
            >
          </div>
        </header>
        <main class="music-room-active-main">
          <section class="music-room-queue">
            <div class="music-room-panel-title">
              已点歌曲 <small>{{ snapshot.state.queue.length }}</small>
            </div>
            <div v-if="current" class="music-room-current-row">
              <img :src="current.music.image || LogoImage" />
              <div class="text-overflow-1">
                <b>正在播放</b
                ><span class="text-overflow-1"
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
                  <el-icon
                    v-if="roomStore.isAdmin && index > 0"
                    title="置顶到列表第一首"
                    @click.stop="roomStore.togglePinQueue(item.id)"
                    ><Upload
                  /></el-icon>
                  <el-icon title="删除" @click.stop="removeQueue(item.id)"
                    ><DeleteFilled
                  /></el-icon>
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
                  <div class="music-room-progress-slider">
                    <el-slider
                      v-model="progressModelValue"
                      :max="playbackLength"
                      :disabled="!roomStore.isAdmin || !current"
                      :show-tooltip="false"
                      @mousedown="progressDragging = true"
                      @touchstart="progressDragging = true"
                      @change="changeProgress" />
                  </div>
                  <span>{{
                    current?.music.duration || formatTime(playbackLength)
                  }}</span>
                </div>
                <div class="music-room-player-actions">
                  <template v-if="roomStore.isAdmin">
                    <el-button
                      circle
                      type="primary"
                      :loading="playLoading"
                      @click="roomStore.togglePlayerAction"
                      ><span
                        v-if="!playLoading"
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
                      <span class="music-icon" title="播放">播</span>
                    </el-button>
                    <span
                      v-if="playback?.playing && !roomStore.localPlaying"
                      class="music-room-player-resume-tip"
                      >点击播放以恢复本地声音</span
                    >
                    <span v-else>管理员控制播放 · 你可调整本地音量</span>
                  </template>
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
              <div class="music-room-panel-title music-room-chat-title">
                <span>聊天</span>
                <button
                  v-if="unreadChatCount"
                  class="music-room-chat-unread"
                  type="button"
                  title="查看最新消息"
                  @click="followLatestChat">
                  {{ unreadChatCount > 99 ? '99+' : unreadChatCount }} 条新消息
                  <el-icon><ArrowDown /></el-icon>
                </button>
              </div>
              <el-scrollbar
                ref="chatScrollbar"
                class="music-room-chat-list"
                @scroll="updateChatScrollPosition">
                <div
                  v-for="message in roomStore.chatMessages"
                  :key="message.id"
                  :class="[
                    'music-room-chat-message',
                    {
                      'music-room-chat-self':
                        message.memberId === snapshot.memberId
                    }
                  ]">
                  <img
                    class="music-room-chat-avatar"
                    :src="chatAvatar(message.memberId)"
                    alt="用户头像" />
                  <div class="music-room-chat-body">
                    <b>
                      <time v-if="message.memberId === snapshot.memberId">{{
                        formatChatTime(message.createdAt)
                      }}</time>
                      <span
                        class="music-room-chat-self-edit"
                        @click="openNicknameDialog"
                        ><el-icon><EditPen /></el-icon
                      ></span>
                      {{ message.nickname }} [{{
                        chatMemberId(message.memberId)
                      }}]
                      <time v-if="message.memberId !== snapshot.memberId">{{
                        formatChatTime(message.createdAt)
                      }}</time>
                    </b>
                    <div class="music-room-chat-content">
                      <span
                        v-if="message.content"
                        class="music-room-chat-text"
                        >{{ message.content }}</span
                      >
                      <img
                        v-if="message.image"
                        class="music-room-chat-image"
                        :src="message.image"
                        alt="聊天图片"
                        @load="handleChatImageLoad" />
                    </div>
                  </div>
                </div>
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
        <el-button
          v-if="roomStore.isAdmin || snapshot.allowGuestQueue"
          class="music-room-trigger"
          @click="openSearchDrawer">
          <span>♪</span>点歌
        </el-button>
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
        ><el-button type="primary" :loading="createLoading" @click="createRoom"
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
        ><el-button type="primary" :loading="joinLoading" @click="joinRoom()"
          >进入</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="nicknameVisible"
      title="修改昵称"
      width="360px"
      append-to-body>
      <el-input
        v-model="roomNickname"
        maxlength="24"
        placeholder="请输入昵称"
        @keyup.enter="saveNickname" />
      <template #footer
        ><el-button @click="nicknameVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="nicknameLoading"
          @click="saveNickname"
          >保存</el-button
        ></template
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
        ><el-button type="primary" :loading="adminLoading" @click="enterAdmin"
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
        <el-form-item>
          <el-switch v-model="settingsGuestQueueEnabled" />
          <span style="margin-left: 8px">允许游客点歌</span>
          <p class="music-room-dialog-tip">
            关闭后只有管理员可以添加歌曲到队列。
          </p>
        </el-form-item>
        <el-form-item label="新的管理员密码"
          ><el-input
            v-model="settingsAdminPassword"
            type="password"
            show-password
            placeholder="不填写则保持原密码"
        /></el-form-item>
        <el-divider>音乐源 Cookie</el-divider>
        <p class="music-room-dialog-tip">
          管理员登录后会自动将本地登录状态同步到歌房服务端。未配置时，请前往左下角设置登录对应音乐平台。
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
          <span style="flex: 1">{{
            snapshot?.credentialSources.includes(source)
              ? '服务端已配置'
              : '未配置'
          }}</span>
          <span>
            <small
              v-if="
                !snapshot?.credentialSources.includes(source) &&
                !hasLocalCookie(source)
              ">
              请前往左下角设置登录
            </small>
            <el-button
              v-if="hasLocalCookie(source)"
              size="small"
              :loading="updatingCookieSource === source"
              @click="updateCookie(source)">
              更新
            </el-button>
          </span>
        </div>
      </el-form>
      <template #footer
        ><el-button
          type="danger"
          plain
          :loading="dissolveLoading"
          @click="dissolveRoom"
          >解散房间</el-button
        ><el-button @click="settingsVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="settingsLoading"
          @click="saveSettings"
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
      class="music-room-search-drawer"
      @close="backToPlaylistSearch">
      <div class="music-room-search-drawer-content" @click="startPlayCheck">
        <div class="music-room-search-head">
          <h2>{{ playlistTitle || '点歌' }}</h2>
          <span class="music-icon" @click="closeSearchDrawer">关</span>
        </div>
        <div v-if="!playlistTitle" class="music-room-search-input">
          <MusicTypeEle
            size="small"
            :value="searchSource"
            @change="changeSearchSource" />
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
        </div>
        <div v-if="!playlistTitle" class="music-room-search-input">
          <div class="music-room-search-switch">
            <el-radio-group v-model="searchType" @change="changeSearchType">
              <el-radio-button value="music">歌曲</el-radio-button>
              <el-radio-button value="playlist">歌单</el-radio-button>
            </el-radio-group>
          </div>
          <el-dropdown trigger="click" @command="loadShortcut">
            <el-button class="music-room-shortcut-button">
              <span>快捷歌单</span>
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in shortcutOptions"
                  :key="option.value"
                  :command="option.value">
                  <span class="music-room-shortcut-option">
                    <span class="music-icon">{{ option.icon }}</span>
                    <span>{{ option.label }}</span>
                  </span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <!-- <div v-if="!playlistTitle" class="music-room-search-shortcuts"></div> -->
        <el-scrollbar
          class="music-room-search-results"
          v-loading="searchLoading">
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
            <el-button type="primary" size="small" @click="addMusic(music)"
              >点歌</el-button
            >
          </div>
          <template v-if="!playlistTitle">
            <div
              v-for="item in searchPlaylists"
              :key="item.type + item.id"
              class="music-room-search-music">
              <img :src="item.image || LogoImage" />
              <div class="text-overflow-1">
                <b class="text-overflow-1">{{ item.name }}</b
                ><span v-if="item.creator || item.trackCount"
                  >{{ item.creator }} · {{ item.trackCount }} 首</span
                >
              </div>
              <el-button type="primary" size="small" @click="openPlaylist(item)"
                >查看</el-button
              >
            </div>
          </template>
        </el-scrollbar>
      </div>
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
    background: var(--music-button-info-background);
    border: 1px solid var(--music-side-divider-color);
    border-radius: var(--music-border-radius);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 11px;
    height: 180px;
    transition: transform 0.2s;
    &:hover {
      background: var(--music-button-info-background-hover);
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
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(310px, 39%) 1fr;
      overflow: hidden;
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
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--music-side-divider-color);
    &-list {
      flex: 1;
      min-height: 0;
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
        display: inline-block;
      }
    }
  }
  &-queue-item {
    > span:first-child {
      width: 22px;
      font-size: 12px;
      opacity: 0.5;
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
      cursor: pointer;
      .music-icon {
        cursor: pointer;
        opacity: 0.75;
        user-select: none;
      }
      .music-icon:hover {
        opacity: 1;
      }
      & + & {
        margin-left: 10px;
      }
    }
    &:hover &-actions,
    &:focus-within &-actions {
      opacity: 1;
    }
  }
  &-control {
    height: 100%;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
        max-width: 400px;
      }
      p {
        opacity: 0.6;
        max-width: 400px;
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
      .music-room-progress-slider {
        flex: 1;
        min-width: 0;
        .el-slider {
          width: 100%;
        }
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
        &.is-circle {
          width: 37px;
          height: 37px;
        }
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
    min-height: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    &-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    &-unread {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      padding: 4px 8px;
      border: 0;
      border-radius: 999px;
      background: var(--music-button-info-border-color);
      color: var(--music-primary-color);
      font-size: 12px;
      font-weight: normal;
      line-height: 1.2;
      cursor: pointer;
      &:hover {
        background: var(--music-background-hover);
      }
      .el-icon {
        font-size: 13px;
      }
    }
    &-list {
      min-height: 0;
      flex: 1 1 auto;
      overflow: hidden;
      padding: 0 20px;
      .music-room-chat-message {
        margin: 0 0 10px;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 13px;
        --music-room-chat-avatar-size: 34px;
        .music-room-chat-avatar {
          width: var(--music-room-chat-avatar-size);
          height: var(--music-room-chat-avatar-size);
          flex: 0 0 var(--music-room-chat-avatar-size);
          border-radius: 10px;
          object-fit: cover;
        }
        .music-room-chat-body {
          min-width: 0;
          max-width: calc(100% - 82px);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
        }
        b {
          opacity: 0.75;
          font-size: 12px;
          flex-shrink: 0;
          time {
            margin-left: 5px;
            opacity: 0.7;
            font-size: 11px;
            font-weight: normal;
          }
        }
        span {
          word-break: break-word;
        }
        .music-room-chat-text {
          width: fit-content;
          max-width: 100%;
          padding: 7px 10px;
          border-radius: 12px;
          background: var(--music-button-info-border-color);
          line-height: 1.4;
          text-align: left;
          cursor: text;
          user-select: text;
          min-height: var(--music-room-chat-avatar-size);
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
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
          max-width: 200px;
          max-height: 200px;
          border-radius: var(--music-border-radius);
          object-fit: contain;
        }
      }
      .music-room-chat-self {
        flex-direction: row-reverse;
        .music-room-chat-body {
          align-items: flex-end;
          text-align: right;
        }
        b {
          color: var(--music-primary-color);
          opacity: 1;
          padding-left: 20px;
          &:hover {
            .music-room-chat-self-edit {
              display: inline-block;
              cursor: pointer;
            }
          }
        }
        &-edit {
          transform: translateY(1px);
          position: absolute;
          left: 0;
          display: none;
        }
        .music-room-chat-text {
          background: var(--music-button-primary-background);
          color: white;
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
    width: var(--el-button-size);
    flex-shrink: 0;
    font-size: 18px;
    padding: 0;
    --el-button-text-color: var(--music-text-color);
    & > span {
      line-height: var(--el-button-size);
    }
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
  &-trigger {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    border: 0;
    padding: 15px 10px;
    border-radius: 12px 0 0 12px !important;
    background: var(--music-button-primary-background);
    color: white;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    box-shadow: 0 4px 16px #0003;
    cursor: pointer;
    transform: none !important;
    &:hover {
      color: white;
    }
  }
  &-dialog-tip {
    margin: 6px 0 0;
    line-height: 1.5;
    font-size: 12px;
    opacity: 0.65;
  }
  &-cookie-row {
    display: flex;
    grid-template-columns: 70px 90px 1fr auto;
    gap: 20px;
    align-items: center;
    margin: 10px 0;
    font-size: 12px;
    & > b {
      width: 60px;
    }
  }
  &-search {
    &-drawer-content {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    &-head {
      padding: 0 20px;
      height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      h2 {
        min-width: 0;
        flex: 1;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    &-back {
      flex-shrink: 0;
      color: var(--music-primary-color);
      font-size: 13px;
    }
    &-switch {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    &-results {
      flex: 1;
      min-height: 0;
      height: auto;
      margin-top: 10px;
    }
    &-input {
      display: flex;
      gap: 8px;
      padding: 0 20px;
      justify-content: space-between;
      :deep(.el-radio-group) {
        margin-left: 0;
      }
      & + & {
        margin-top: 10px;
      }
      .el-button {
        --el-button-size: 32px;
      }
    }
    &-shortcuts {
      padding: 0 20px;
      margin-top: 10px;
      .el-dropdown,
      .music-room-shortcut-button {
        width: 100%;
      }
      .music-room-shortcut-button {
        justify-content: space-between;
      }
    }
    &-shortcut-option {
      display: flex;
      align-items: center;
      gap: 8px;
      .music-icon {
        width: 20px;
        text-align: center;
      }
    }
    &-music {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      border-bottom: 1px solid var(--music-side-divider-color);
      img {
        width: 45px;
        height: 45px;
        object-fit: cover;
        border-radius: var(--music-border-radius);
      }

      .el-button {
        opacity: 0;
      }

      &:hover {
        background-color: var(--music-background-hover);
        .el-button {
          opacity: 1;
        }
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
      overflow: visible;
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
      grid-template-columns: 60px 90px 1fr auto;
    }
  }
}
</style>
