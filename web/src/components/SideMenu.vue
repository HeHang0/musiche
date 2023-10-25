<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { elementScrollClick } from '../utils/utils';
import { usePlayStore } from '../stores/play';
import DefaultImage from '../assets/images/default.png';
const { options } = useRouter();
const route = useRoute();
const play = usePlayStore();

const playListName = ref('');
const createPlaylistShow = ref(false);

onMounted(() => {
  elementScrollClick(route.meta.key as any);
});
const menus: any[] = [];
options.routes.forEach(item => {
  if (item.name && item.meta?.show != false) {
    menus.push({
      name: item.name,
      key: item.meta?.key,
      show: item.meta?.show,
      icon: item.meta?.icon
    });
  }
});
function createMyPlaylists() {
  if (!playListName.value) return;
  play.createMyPlaylists(playListName.value);
  createPlaylistShow.value = false;
}
</script>

<template>
  <el-aside class="music-aside">
    <div class="music-aside-title">
      <img :src="DefaultImage" class="music-aside-title-logo" />
      <span class="music-aside-title-text"> 音乐和 </span>
    </div>
    <el-scrollbar>
      <el-menu
        ref="menuRef"
        class="music-aside-menu"
        style="margin-top: 20px"
        router
        :default-active="route.path">
        <template v-for="menu in menus" :key="menu.key">
          <el-menu-item
            :index="'/' + menu.key"
            :class="route.meta.key == menu.key ? 'is-active' : ''">
            <span v-if="menu.icon" class="music-icon">{{ menu.icon }}</span>
            <span :id="menu.key">{{ menu.name }}</span>
          </el-menu-item>
        </template>
        <el-divider
          v-if="
            play.musicHistory.length > 0 || play.myLoves.length > 0
          "></el-divider>
        <el-menu-item
          v-if="play.myLoves.length > 0"
          index="/lover"
          :class="route.path == 'lover' ? 'is-active' : ''">
          <span class="music-icon">爱</span>
          <span id="lover">我喜欢的音乐</span>
        </el-menu-item>
        <el-menu-item
          v-if="play.musicHistory.length > 0"
          index="/recent"
          :class="route.path == 'recent' ? 'is-active' : ''">
          <span class="music-icon">时</span>
          <span id="recent">最近播放</span>
        </el-menu-item>
        <el-divider v-if="play.myFavorites.length > 0"></el-divider>
        <el-sub-menu index="favorite" v-if="play.myFavorites.length > 0">
          <template #title>
            <el-menu-item>
              <span class="music-icon">藏</span>
              <span>收藏的歌单</span>
            </el-menu-item>
          </template>
          <el-menu-item
            class="el-menu-item-wide"
            v-for="item in play.myFavorites"
            :title="item.name"
            :index="`/playlist/${item.type}/${item.id}`">
            <img :src="item.image || DefaultImage" />
            <div class="text-overflow-2">{{ item.name }}</div>
          </el-menu-item>
        </el-sub-menu>
        <el-divider v-if="play.myPlaylists.length > 0"></el-divider>
        <el-sub-menu index="created" v-if="play.myPlaylists.length > 0">
          <template #title>
            <el-menu-item>
              <span class="music-icon">编</span>
              <span>创建的歌单</span>
            </el-menu-item>
          </template>
          <el-menu-item
            class="el-menu-item-wide"
            v-for="item in play.myPlaylists"
            :title="item.name"
            :index="`/created/${item.id}`">
            <img
              :src="
                (item.musicList &&
                  item.musicList[0] &&
                  item.musicList[0].image) ||
                item.image ||
                DefaultImage
              " />
            <div class="text-overflow-2">{{ item.name }}</div>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
      <el-dialog
        v-model="play.selectPlaylistShow"
        width="450"
        :show-close="false">
        <template #header="{ close, titleId, titleClass }">
          <div class="music-select-playlist-title">
            <span :id="titleId" :class="titleClass">收藏到歌单</span>
            <span class="music-icon" @click="close">关</span>
          </div>
        </template>
        <div class="music-select-playlist">
          <div class="music-select-playlist-item">
            <el-button
              class="music-button-pure music-select-playlist-item-create">
              +
            </el-button>
            <div
              class="music-select-playlist-item-right"
              @click="
                playListName = '';
                createPlaylistShow = true;
              ">
              创建新歌单
            </div>
          </div>
          <div
            class="music-select-playlist-item"
            v-for="item in play.myPlaylists"
            @click="
              play.addMyPlaylistsMusic(item.id, play.myPlaylistsPreMusics)
            ">
            <img
              class="music-select-playlist-item-image"
              :src="
                item.image ||
                (item.musicList &&
                  item.musicList[0] &&
                  item.musicList[0].image) ||
                DefaultImage
              " />
            <div class="music-select-playlist-item-right text-overflow-1">
              <span class="music-select-playlist-item-name text-overflow-1">
                {{ item.name }}
              </span>
              <span class="music-select-playlist-item-count text-overflow-1">
                {{ (item.musicList && item.musicList.length) || 0 }}首音乐
              </span>
            </div>
          </div>
        </div>
      </el-dialog>
      <el-dialog
        v-model="createPlaylistShow"
        width="450"
        class="music-create-playlist-dialog"
        :show-close="false">
        <template #header="{ close, titleId, titleClass }">
          <div class="music-create-playlist-header">
            <span :id="titleId" :class="titleClass"></span>
            <span class="music-icon" @click="close">关</span>
          </div>
        </template>
        <div class="music-create-playlist">
          <div class="music-create-playlist-title">创建歌单</div>
          <el-input
            class="music-create-playlist-name"
            v-model="playListName"
            :maxlength="40"
            show-word-limit
            type="textarea"
            placeholder="输入歌单标题">
          </el-input>
          <el-button
            type="primary"
            @click="createMyPlaylists"
            :disabled="playListName.length <= 0">
            创建
          </el-button>
        </div>
      </el-dialog>
    </el-scrollbar>
  </el-aside>
</template>
<style lang="less" scoped>
.music-aside {
  width: 205px;
  .music-icon {
    margin-right: 5px;
  }
  :deep(.el-menu--inline) {
    background: transparent !important;
  }
  & > .el-scrollbar {
    height: calc(100% - 80px);
  }
  &-title {
    height: 80px;
    display: flex;
    align-items: center;
    // justify-content: center;
    padding: 20px 20px 0 20px;
    &-logo {
      width: 50px;
      height: 50px;
    }
    &-text {
      font-size: 20px;
      margin-left: 10px;
      font-weight: bold;
    }
  }
  &-menu {
    background-color: transparent;
    border-right: none;
    .el-divider {
      margin: 10px 40px;
      width: calc(100% - 80px);
    }
    :deep(.el-sub-menu__title) {
      padding-left: 0 !important;
      padding-right: 0 !important;
      .el-sub-menu__icon-arrow {
        right: 30px;
      }
      &:hover {
        background-color: transparent;
      }
    }
    .el-menu-item {
      margin: 2px 20px;
      height: 35px;
      border-radius: 8px;
      font-size: 13px;
      width: calc(100% - 40px);
      padding: 0 10px !important;
      &:hover {
        background: var(--music-button-background-hover);
      }
      img {
        width: 40px;
        height: 40px;
        border-radius: var(--music-border-radio);
        margin-right: 5px;
      }
      &-wide {
        height: 50px;
        font-size: 12px;
      }
    }
    .el-menu-item.is-active {
      color: white;
      background: var(--music-button-primary-background);
    }
  }
  :deep(.el-menu-item) {
    display: flex;
  }
}
.music-create-playlist {
  height: 230px;
  text-align: center;
  padding: 0 30px;
  color: var(--color-text);
  &-dialog .music-icon {
    cursor: pointer;
  }
  &-header {
    text-align: right;
    :deep(.el-dialog__header) {
      padding-bottom: 0;
    }
  }
  &-title {
    font-size: 20px;
    font-weight: bold;
    margin: 0 0 20px 0;
  }
  &-name {
    height: 85px;
    :deep(.el-textarea__inner) {
      background-color: rgba(183, 183, 183, 0.1);
      resize: none;
      height: 100%;
    }
  }
  button {
    margin: 20px 0 0 0;
  }
}
.music-select-playlist {
  height: 270px;
  width: 100%;
  margin-top: 10px;
  overflow-y: auto;
  &-title {
    text-align: center;
    font-weight: bold;
    font-size: 22px;
    position: relative;
    .music-icon {
      position: absolute;
      top: 0;
      right: 0;
      cursor: pointer;
    }
  }
  &-item {
    display: flex;
    padding: 7px 30px;
    cursor: pointer;
    &:hover {
      background-color: #efeff0;
    }
    &-create {
      background-color: rgba(183, 183, 183, 0.25);
      &:hover {
        background-color: rgba(183, 183, 183, 0.3);
      }
    }
    &-create,
    &-image {
      width: 50px;
      height: 50px;
      border-radius: var(--music-border-radio);
    }
    &-right {
      flex: 1;
      margin-left: 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    &-name {
      font-size: 16px;
    }
    &-count {
      font-size: 13px;
      color: var(--el-text-color-placeholder);
    }
  }
}
:deep(.el-dialog__header) {
  margin-right: 0;
  padding-bottom: 0;
}
:deep(.el-dialog__body) {
  padding: 0;
}
</style>
