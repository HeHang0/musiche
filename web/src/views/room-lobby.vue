<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Lock, Search, Unlock } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { currentRoomKey, useRoomStore } from '../stores/room';
import { usePlayStore } from '../stores/play';
import { RoomRequestError } from '../utils/room';
import { messageOption } from '../utils/utils';
import {
  generateRoomChatKey,
  roomChatKeyHash
} from '../utils/room-chat-crypto';

const roomStore = useRoomStore();
const playStore = usePlayStore();
const route = useRoute();
const router = useRouter();
const roomCredentialsKey = 'musiche-room-credentials';
type RoomCredential = string | { entryPassword?: string };

const rooms = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref('');
const loaded = ref(false);
const loadingList = ref(false);
const redirecting = ref(false);
const createVisible = ref(false);
const joinVisible = ref(false);
const createLoading = ref(false);
const joinLoading = ref(false);
const targetRoomId = ref('');
const nickname = ref(localStorage.getItem('musiche-room-nickname') || '');
const joinPassword = ref('');
const createForm = ref({
  name: '',
  entryPassword: '',
  adminPassword: '',
  chatEncrypted: false
});
const targetRoomEncrypted = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function roomPath(roomId: string) {
  return `/room/${encodeURIComponent(roomId)}`;
}

function readRoomCredentials(): Record<string, RoomCredential> {
  try {
    return JSON.parse(localStorage.getItem(roomCredentialsKey) || '{}');
  } catch {
    return {};
  }
}

function getRoomCredential(roomId: string) {
  const credentials = readRoomCredentials();
  if (!Object.prototype.hasOwnProperty.call(credentials, roomId)) return null;
  const credential = credentials[roomId];
  return typeof credential === 'string'
    ? credential
    : credential?.entryPassword || '';
}

function saveRoomCredential(roomId: string, entryPassword: string) {
  const credentials = readRoomCredentials();
  credentials[roomId] = entryPassword;
  localStorage.setItem(roomCredentialsKey, JSON.stringify(credentials));
}

function clearRoomEntryPassword(roomId: string) {
  const credentials = readRoomCredentials();
  const credential = credentials[roomId];
  if (credential === undefined) return;
  credentials[roomId] = '';
  localStorage.setItem(roomCredentialsKey, JSON.stringify(credentials));
}

function clearMissingRoomCache(roomId: string) {
  if (localStorage.getItem(currentRoomKey) === roomId)
    localStorage.removeItem(currentRoomKey);
  const credentials = readRoomCredentials();
  delete credentials[roomId];
  localStorage.setItem(roomCredentialsKey, JSON.stringify(credentials));
  roomStore.removeAdminTokenCache([roomId]);
}

function isEntryPasswordError(error: any) {
  return error?.message === '房间密码错误';
}

function isRoomRequestStatus(error: unknown, status: number) {
  return error instanceof RoomRequestError && error.status === status;
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}

async function pauseOriginalPlayer() {
  if (!playStore.playStatus.playing) return;
  try {
    await playStore.pause();
  } catch {
    // The room itself can still be opened when the previous player is gone.
  }
}

async function loadRooms() {
  loadingList.value = true;
  try {
    const result = await roomStore.list(keyword.value, page.value);
    rooms.value = result.items;
    total.value = result.total;
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '无法加载歌房列表'));
  } finally {
    loadingList.value = false;
  }
}

function openCreate() {
  createForm.value = {
    name: '',
    entryPassword: '',
    adminPassword: generatePassword(),
    chatEncrypted: false
  };
  createVisible.value = true;
}

async function createRoom() {
  if (!nickname.value.trim()) {
    ElMessage(messageOption('请先填写昵称'));
    return;
  }
  createLoading.value = true;
  try {
    const chatKey = createForm.value.chatEncrypted ? generateRoomChatKey() : '';
    await roomStore.create({
      ...createForm.value,
      nickname: nickname.value.trim(),
      chatKey
    });
    await pauseOriginalPlayer();
    localStorage.setItem('musiche-room-nickname', nickname.value.trim());
    if (roomStore.room) {
      saveRoomCredential(roomStore.room.id, createForm.value.entryPassword);
      await router.replace({
        path: roomPath(roomStore.room.id),
        hash: roomChatKeyHash(chatKey)
      });
    }
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '创建歌房失败'));
  } finally {
    createLoading.value = false;
  }
}

async function openJoin(room: any) {
  targetRoomId.value = room.id;
  targetRoomEncrypted.value = Boolean(room.chatEncrypted);
  const saved = getRoomCredential(room.id);
  if (saved !== null && !targetRoomEncrypted.value) {
    joinPassword.value = saved;
    await joinRoom(true);
    return;
  }
  joinPassword.value = '';
  joinVisible.value = true;
}

async function joinRoom(automatic = false) {
  if (!nickname.value.trim()) {
    if (!automatic) ElMessage(messageOption('请先填写昵称'));
    return;
  }
  joinLoading.value = true;
  try {
    await roomStore.join(targetRoomId.value, {
      nickname: nickname.value.trim(),
      entryPassword: joinPassword.value
    });
    if (roomStore.snapshot?.nickname !== nickname.value.trim())
      await roomStore.updateNickname(nickname.value.trim());
    await pauseOriginalPlayer();
    localStorage.setItem('musiche-room-nickname', nickname.value.trim());
    saveRoomCredential(targetRoomId.value, joinPassword.value);
    await router.replace(roomPath(targetRoomId.value));
  } catch (error: any) {
    if (automatic && isEntryPasswordError(error)) {
      clearRoomEntryPassword(targetRoomId.value);
      joinPassword.value = '';
      joinVisible.value = true;
    } else {
      ElMessage(messageOption(error?.message || '进入歌房失败'));
    }
  } finally {
    joinLoading.value = false;
  }
}

async function redirectToCurrentRoom() {
  const roomId = localStorage.getItem(currentRoomKey);
  if (!roomId || roomStore.room) return false;
  redirecting.value = true;
  try {
    await roomStore.open(roomId);
    await pauseOriginalPlayer();
    await router.replace(roomPath(roomId));
    return true;
  } catch (error: any) {
    if (isRoomRequestStatus(error, 404)) clearMissingRoomCache(roomId);
    else if (isRoomRequestStatus(error, 403))
      localStorage.removeItem(currentRoomKey);
    else ElMessage(messageOption(error?.message || '恢复歌房失败'));
    return false;
  } finally {
    redirecting.value = false;
  }
}

onMounted(async () => {
  const legacyRoomId =
    typeof route.query.room === 'string' ? route.query.room : '';
  if (legacyRoomId) {
    const query = { ...route.query };
    delete query.room;
    await router.replace({ path: roomPath(legacyRoomId), query });
    return;
  }
  try {
    await roomStore.initialize();
    if (!(await redirectToCurrentRoom())) await loadRooms();
  } catch (error: any) {
    ElMessage(messageOption(error?.message || '在线歌房初始化失败'));
  } finally {
    loaded.value = true;
  }
});

watch(keyword, () => {
  page.value = 1;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(loadRooms, 300);
});
</script>

<template>
  <div class="music-room">
    <section
      v-loading="!loaded || redirecting"
      class="music-room-lobby music-page-padding">
      <div class="music-room-lobby-header">
        <div class="music-room-lobby-header-title">
          <h1>在线歌房</h1>
          <p>和朋友同步听歌、点歌和聊天</p>
        </div>
        <div class="music-room-lobby-header-operate">
          <el-input v-model="keyword" clearable placeholder="搜索房间名称">
            <template #prefix
              ><el-icon><Search /></el-icon
            ></template>
          </el-input>
          <el-button type="primary" @click="openCreate">创建歌房</el-button>
        </div>
      </div>
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
          <template #description
            ><el-button type="primary" @click="openCreate"
              >创建歌房</el-button
            ></template
          >
        </el-empty>
        <article v-for="item in rooms" :key="item.id" class="music-room-card">
          <div class="music-room-card-title">
            <span class="text-overflow-1">{{ item.name }}</span>
            <small v-if="item.chatEncrypted" class="music-room-card-encrypted">
              端到端加密聊天 </small
            ><el-icon><Lock v-if="item.locked" /><Unlock v-else /></el-icon>
          </div>
          <div>{{ item.onlineCount }} / {{ item.maxMembers }} 人在线</div>
          <p class="text-overflow-1">
            {{
              item.currentMusic
                ? `正在播放：${item.currentMusic.name} · ${item.currentMusic.singer}`
                : '暂无歌曲'
            }}
          </p>
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
          <el-form-item label="聊天隐私">
            <el-switch
              v-model="createForm.chatEncrypted"
              :disabled="!roomStore.config?.chatEncryptionSupported"
              active-text="端到端加密聊天" />
            <p class="music-room-dialog-tip">
              {{
                roomStore.config?.chatEncryptionSupported
                  ? '密钥只保存在完整邀请链接的 #key 中，服务器无法解密聊天内容。'
                  : '暂不可用端到端加密。'
              }}
            </p>
          </el-form-item>
        </el-form>
        <template #footer
          ><el-button @click="createVisible = false">取消</el-button
          ><el-button
            type="primary"
            :loading="createLoading"
            @click="createRoom"
            >创建并进入</el-button
          ></template
        >
      </el-dialog>
      <el-dialog
        v-model="joinVisible"
        title="进入歌房"
        width="400px"
        append-to-body>
        <el-form label-position="top">
          <el-form-item label="昵称">
            <el-input v-model="nickname" maxlength="24" />
          </el-form-item>
          <el-form-item label="房间密码">
            <el-input
              v-model="joinPassword"
              type="password"
              show-password
              placeholder="公开房间可留空" />
          </el-form-item>
          <p v-if="targetRoomEncrypted" class="music-room-dialog-tip">
            此房间聊天已端到端加密。通过大厅进入时没有聊天密钥，需使用房主分享的完整邀请链接才能查看和发送消息。
          </p>
        </el-form>
        <template #footer
          ><el-button @click="joinVisible = false">取消</el-button
          ><el-button type="primary" :loading="joinLoading" @click="joinRoom()"
            >进入</el-button
          ></template
        >
      </el-dialog>
    </section>
  </div>
</template>

<style scoped lang="less">
.music-room {
  height: 100%;
  color: var(--music-text-color);
}
.music-room-lobby {
  flex-direction: column;
  height: 100%;
  padding: 0 20px;
  display: flex;
}
.music-room-lobby-header {
  justify-content: space-between;
  align-items: center;
  margin: 30px 0 20px;
  display: flex;
  h1 {
    margin: 0;
    display: inline;
  }
  p {
    opacity: 0.6;
    margin: 8px 0 0 8px;
    display: inline-block;
  }
}
.music-room-lobby-header-operate {
  display: flex;
  gap: 10px;
  width: min(480px, 100%);
  .el-input {
    flex: 1;
  }
}
.music-room-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-height: 160px;
}
.music-room-card::before {
}
.music-room-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--music-side-divider-color);
  border-radius: var(--music-border-radius);
  position: relative;
  &::before {
    content: ' ';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: var(--music-background);
    border-radius: var(--music-border-radius);
    opacity: 0.35;
    backdrop-filter: blur(10px);
  }
  .music-room-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
    .text-overflow-1 {
      flex: 1;
    }
  }
  p {
    margin: 0;
    opacity: 0.65;
  }
  .music-room-card-encrypted {
    width: fit-content;
    padding: 1px 5px;
    border: 1px solid
      color-mix(in srgb, var(--music-primary-color) 28%, transparent);
    border-radius: 999px;
    color: var(--music-primary-color);
    background: color-mix(in srgb, var(--music-primary-color) 9%, transparent);
    font-size: 10px;
  }
  .el-button {
    align-self: flex-end;
  }
}
.el-pagination {
  justify-content: center;
  margin-top: 24px;
}
.music-room-dialog-tip {
  margin: 6px 0 0;
  line-height: 1.5;
  font-size: 12px;
  opacity: 0.65;
}
@media (max-width: 850px) {
  .music-room-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .music-room-lobby-header {
    align-items: stretch;
    flex-direction: column;
  }
  .music-room-lobby-header-operate {
    width: 100%;
  }
  .music-room-cards {
    grid-template-columns: 1fr;
  }
}
</style>
