<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { elementScrollClick } from '../utils/utils';
import { usePlayStore } from '../stores/play';
const { options } = useRouter();
const route = useRoute();
const play = usePlayStore();

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
</script>

<template>
  <el-aside class="music-aside">
    <div class="music-aside-title">
      <img src="/logo.png" class="music-aside-title-logo" />
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
        <el-sub-menu>
          <template #title>
            <el-menu-item>
              <span class="music-icon">藏</span>
              <span>收藏的歌单</span>
            </el-menu-item>
          </template>
          <el-menu-item
            class="el-menu-item-wide"
            v-for="item in play.myFavorites"
            :index="`/playlist/${item.type}/${item.id}`">
            <img :src="item.image" />
            <div class="text-overflow-2">{{ item.name }}</div>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
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
    }
    .el-menu-item {
      margin: 2px 20px;
      height: 35px;
      border-radius: 8px;
      font-size: 13px;
      width: calc(100% - 40px);
      padding-left: var(--el-menu-base-level-padding) !important;
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
        font-size: 11px;
      }
    }
    .el-menu-item.is-active {
      color: white;
      background: var(--music-button-primary-background);
    }
  }
}
</style>
<style lang="less">
.music-aside {
  .el-menu-item {
    display: flex;
  }
}
</style>
