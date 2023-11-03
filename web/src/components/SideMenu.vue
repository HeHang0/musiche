<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayStore } from '../stores/play';
import LogoImage from '../assets/images/logo-circle.png';
import LogoCircleImage from '../assets/images/logo-circle.png';
import { useSettingStore } from '../stores/setting';
const { options } = useRouter();
const route = useRoute();
const play = usePlayStore();
const setting = useSettingStore();

const playListName = ref('');
const createPlaylistShow = ref(false);
const menus: any[] = [];
options.routes.forEach(item => {
  if (item.name && item.meta?.show != false) {
    menus.push({
      name: item.name,
      key: item.meta?.key,
      show: item.meta?.show,
      icon: item.meta?.icon,
      divider: item.meta?.divider
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
      <img :src="LogoCircleImage" class="music-aside-title-logo" />
      <span class="music-aside-title-text"> 音乐和 </span>
    </div>
    <el-scrollbar>
      <el-menu
        ref="menuRef"
        class="music-aside-menu"
        router
        :default-openeds="['favorite']"
        :default-active="route.path">
        <template v-for="item in menus">
          <el-divider v-if="item.divider"></el-divider>
          <el-menu-item
            :index="'/' + item.key"
            :id="'/' + item.key"
            v-if="
              item.key !== 'yours' ||
              setting.userInfo.cloud.id ||
              setting.userInfo.qq.id ||
              setting.userInfo.migu.id
            "
            :class="route.meta.key == item.key ? 'is-active' : ''">
            <span class="music-icon">{{ item.icon }}</span>
            <span>{{ item.name }}</span>
          </el-menu-item>
        </template>
        <el-divider></el-divider>
        <el-sub-menu index="favorite">
          <template #title>
            <el-menu-item>
              <span class="music-icon">藏</span>
              <span>收藏的歌单({{ play.myFavorites.length }})</span>
            </el-menu-item>
          </template>
          <el-menu-item
            class="el-menu-item-wide"
            v-for="item in play.myFavorites"
            :title="item.name"
            :id="`/playlist/${item.type}/${item.id}`"
            :index="`/playlist/${item.type}/${item.id}`">
            <img :src="item.image || LogoImage" />
            <div class="text-overflow-2">{{ item.name }}</div>
          </el-menu-item>
        </el-sub-menu>
        <el-divider></el-divider>
        <el-sub-menu index="created">
          <template #title>
            <el-menu-item>
              <span class="music-icon">编</span>
              <span>创建的歌单({{ play.myPlaylists.length }})</span>
            </el-menu-item>
          </template>
          <el-menu-item
            class="el-menu-item-wide"
            v-for="item in play.myPlaylists"
            :title="item.name"
            :id="`/created/${item.id}`"
            :index="`/created/${item.id}`">
            <img
              :src="
                (item.musicList &&
                  item.musicList[0] &&
                  item.musicList[0].image) ||
                item.image ||
                LogoImage
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
                LogoImage
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
  background-color: var(--music-side-background);
  color: var(--music-side-text-color);
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
    --el-menu-item-height: 35px;
    padding-top: 20px;
    .el-divider {
      margin: 10px 40px;
      width: calc(100% - 80px);
      border-color: var(--music-side-divider-color);
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
      & > span {
        opacity: 0.8;
      }
      &.is-active {
        & > span {
          opacity: 1;
        }
      }
      &:hover {
        background: var(--music-side-menu-color-hover);
      }
      img {
        width: 40px;
        height: 40px;
        border-radius: var(--music-border-radius);
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
      border-radius: var(--music-border-radius);
    }
    &-right {
      flex: 1;
      min-width: 0;
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
