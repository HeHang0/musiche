<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { Music } from '../utils/type';
import { useSettingStore } from '../stores/setting';
import { usePlayStore } from '../stores/play';
import MusicList from '../components/MusicList.vue';
import {
  checkReadPermission,
  clearArray,
  generateGuid,
  getFileName,
  readAudioFiles
} from '../utils/utils';
import { fileToMusic, fileHandlerDB, pathToMusic } from '../utils/api/local';
import { useThrottleFn } from '@vueuse/core';
import { musicOperate } from '../utils/http';

const play = usePlayStore();
const setting = useSettingStore();
const musicList = ref([] as Music[]);
const musicListAll = [] as Music[];
const loading = ref(false);
const selectLocalDirShow = ref(false);
const searchKey = ref('');
const startSearchThrottle = useThrottleFn(startSearch, 500);
function startSearch() {
  musicList.value = searchKey.value
    ? musicListAll.filter(
        m =>
          m.name.includes(searchKey.value) || m.singer.includes(searchKey.value)
      )
    : musicListAll;
}
var directorySelecting = false;

async function addDirectory() {
  if (directorySelecting) return;
  directorySelecting = true;
  if (setting.config.file) {
    const result = await musicOperate('/file/select');
    if (result && Array.isArray(result.data)) {
      result.data.map((filePath: string) => {
        if (!setting.localDirectories.find(m => m.path === filePath)) {
          setting.localDirectories.push({
            name: getFileName(filePath),
            path: filePath,
            selected: true
          });
        }
      });
      result.length > 0 && setting.saveLocalDirectories();
    }
  } else {
    await addDirectoryWeb();
  }
  directorySelecting = false;
}

async function addDirectoryWeb() {
  try {
    const handler: FileSystemDirectoryHandle = await (
      window as any
    ).showDirectoryPicker();
    const allFileHandler = (await fileHandlerDB.getAllFileHandler()) || [];
    let existsFileHandler: {
      key: string;
      handler: FileSystemDirectoryHandle;
    } | null = null;
    for (let i = 0; i < allFileHandler.length; i++) {
      if (await allFileHandler[i].handler.isSameEntry(handler)) {
        existsFileHandler = {
          key: allFileHandler[i].key,
          handler: handler
        };
        fileHandlerDB.updateHandler(existsFileHandler);
        break;
      }
    }
    if (!existsFileHandler) {
      const key = new Date().valueOf().toString() + generateGuid();
      existsFileHandler = { key, handler };
      fileHandlerDB.saveFileHandler(key, handler);
    }
    if (
      existsFileHandler &&
      !setting.localDirectories.find(m => m.path === existsFileHandler?.key)
    ) {
      setting.localDirectories.push({
        name: handler.name,
        path: existsFileHandler.key,
        selected: true
      });
      setting.saveLocalDirectories();
    }
  } catch {}
  directorySelecting = false;
}
function scanDir() {
  selectLocalDirShow.value = false;
  syncLocalMusic();
}

async function showLocalDirectorySelection() {
  selectLocalDirShow.value = true;
}

async function syncLocalMusic() {
  loading.value = true;
  try {
    if (setting.config.file) {
      await syncLocalMusicBackend();
      clearArray(musicList.value);
      musicListAll.forEach(m => musicList.value.push(m));
    } else {
      clearArray(musicList.value);
      await syncLocalMusicWeb();
    }
  } catch {}
  musicListAll.sort((a, b) => a.name.localeCompare(b.name));
  musicList.value.sort((a, b) => a.name.localeCompare(b.name));
  loading.value = false;
}

async function syncLocalMusicBackend() {
  clearArray(musicListAll);
  for (let i = 0; i < setting.localDirectories.length; i++) {
    const directory = setting.localDirectories[i];
    if (!directory.selected) continue;
    const musicFilesText = await musicOperate(
      `/file/list/audio?path=${encodeURIComponent(directory.path)}&recursive=1`
    );
    if (musicFilesText && musicFilesText.data) {
      pathToMusic(JSON.parse(musicFilesText.data)).forEach(m => {
        const filePath = m.url || m.id;
        if (
          filePath &&
          !musicListAll.find(
            item => item.url == filePath || item.id == filePath
          )
        ) {
          musicListAll.push(m);
        }
      });
    }
  }
}

async function syncLocalMusicWeb() {
  const result = await fileHandlerDB.getAllFileHandler();
  if (!result) return;
  clearArray(musicListAll);
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const localDirectory = setting.localDirectories.find(
      m => m.path == item.key
    );
    if (!localDirectory || !localDirectory.selected) {
      continue;
    }
    await loadMusicList(item.key);
  }
}

async function loadMusicList(key: string) {
  if (!fileHandlerDB.handleCache[key]) return;
  if (
    (await checkReadPermission(
      fileHandlerDB.handleCache[key].handler as any
    )) === 'granted'
  ) {
    const files = await readAudioFiles(
      fileHandlerDB.handleCache[key].handler,
      key
    );
    (await fileToMusic(files)).forEach(m => {
      musicListAll.push(m);
      musicList.value.push(m);
    });
  }
}

async function initMusic() {
  if (setting.localDirectories.length === 0 && setting.config.file) {
    const myMusic = await musicOperate('/file/directory/music');
    if (myMusic && myMusic.data) {
      setting.localDirectories.push({
        name: '我的音乐',
        path: myMusic.data,
        selected: true
      });
    }
  }
}

onMounted(async () => {
  setting.currentMusicTypeShow = false;
  initMusic().then(syncLocalMusic);
});
</script>

<template>
  <div class="music-local">
    <div class="music-local-header">
      <div>
        <span>
          <span class="music-local-header-name">本地音乐</span>
          <span class="music-local-header-desc">
            共{{ musicList.length }}首</span
          >
        </span>
        <span
          class="music-local-header-dir"
          @click="showLocalDirectorySelection">
          选择目录<span class="music-icon">右</span>
        </span>
      </div>
      <div class="music-local-header-operate">
        <span>
          <el-button-group>
            <el-button
              type="primary"
              :disabled="loading || musicList.length === 0"
              @click="play.play(undefined, musicList)">
              <span class="music-icon">播</span>
              <span class="music-local-header-button-text">播放</span>
            </el-button>
            <el-button
              type="primary"
              :disabled="loading || musicList.length === 0"
              @click="
                play.add(musicList);
                play.showCurrentListPopover();
              "
              title="添加到播放列表">
              <span class="music-icon">添</span>
            </el-button>
          </el-button-group>
          <span>
            <el-button
              type="info"
              :disabled="loading || musicList.length === 0"
              @click="play.beforeAddMyPlaylistsMusic(musicList)">
              <span class="music-icon">收</span>
              <span class="music-local-header-button-text">收藏</span>
            </el-button>
            <el-button
              type="info"
              :disabled="loading"
              :icon="Refresh"
              title="同步本地音乐"
              @click="syncLocalMusic">
            </el-button>
          </span>
        </span>
        <el-input
          class="music-local-header-search"
          v-model="searchKey"
          placeholder="搜索"
          :readonly="loading"
          @keyup.enter.native="startSearch"
          @input="startSearchThrottle"
          clearable>
          <template #prefix>
            <el-icon
              class="el-input__icon music-local-header-search-icon"
              @click="startSearch">
              <Search />
            </el-icon>
          </template>
        </el-input>
      </div>
    </div>
    <el-scrollbar>
      <MusicList :loading="loading" :list="musicList" />
    </el-scrollbar>
    <el-dialog
      v-model="selectLocalDirShow"
      width="450"
      class="music-local-dialog"
      :show-close="false">
      <template #header="{ close, titleId, titleClass }">
        <div class="music-local-dialog-sel-dir-header">
          <span :id="titleId" :class="titleClass">选择本地文件夹</span>
          <span class="music-icon" @click="close">关</span>
        </div>
      </template>
      <div class="music-local-dialog-sel-dir">
        <p>将自动扫描已添加的音乐目录</p>
        <div class="music-local-dialog-sel-dir-items">
          <el-checkbox
            v-for="item in setting.localDirectories"
            v-model="item.selected"
            size="large"
            :title="item.path">
            {{ item.name }}
          </el-checkbox>
        </div>
        <span class="music-local-dialog-sel-dir-footer">
          <el-button @click="addDirectory"> 添加文件夹 </el-button>
          <el-button type="primary" @click="scanDir"> 确认 </el-button>
        </span>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="less" scoped>
.music-local {
  height: 100%;
  display: flex;
  flex-direction: column;
  &-header {
    padding: 0 var(--music-page-padding-horizontal);
    & > div {
      display: flex;
      justify-content: space-between;
    }
    &-name {
      font-size: 24px;
      font-weight: bold;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    &-desc {
      height: 100px;
      margin-top: 10px;
    }
    &-dir {
      cursor: pointer;
      color: var(--music-primary-color);
      opacity: 0.8;
      .music-icon {
        font-size: 14px;
      }
    }
    .el-button-group {
      margin-right: var(--music-button-margin);
    }
    @media (max-width: 520px) {
      --music-button-margin: 8px;
      .music-local-header-button-text {
        display: none;
      }
      .music-icon {
        margin-right: 0;
      }
      .el-button {
        padding: 8px 10px;
      }
    }
    &-search {
      width: 150px;
      height: 37px;
      margin-left: 10px;
      :deep(.el-input__wrapper) {
        border-radius: 9999px;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      &-icon {
        cursor: pointer;
        &:hover {
          color: var(--music-text-color);
        }
      }
    }
  }
  & > .el-scrollbar {
    margin-top: 5px;
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
    height: auto;
    flex: 1;
  }
  &-dialog {
    &-sel-dir {
      &-header {
        text-align: center;
        .music-icon {
          position: absolute;
          top: 0;
          right: 0;
        }
      }
      &-items {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        padding: 20px 0;
      }
      &-footer {
        display: flex;
        justify-content: space-between;
        button {
          width: 48%;
          border-radius: var(--music-infinity);
        }
      }
    }
  }
}
:deep(.el-dialog__body) {
  padding: 10px 40px 40px 40px;
}
</style>
