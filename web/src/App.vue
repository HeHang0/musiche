<script setup lang="ts">
import { RouterView } from 'vue-router';
import SideMenu from './components/SideMenu.vue';
import Header from './components/Header.vue';
import Footer from './components/Footer.vue';
import CurrentList from './components/CurrentList.vue';
import PlayDetail from './components/PlayDetail.vue';
import WindowHelper from './components/WindowHelper.vue';
import { webView2Services } from './utils/utils';
import LogoImage from './assets/images/logo.png';
import LogoCircleImage from './assets/images/logo-circle.png';
import { MusicConnection } from './stores/connection';
import { usePlayStore } from './stores/play';
import { useSettingStore } from './stores/setting';

const play = usePlayStore();
const setting = useSettingStore();
document.addEventListener(
  'error',
  function (event: ErrorEvent) {
    const target = event.target as any;
    if (target.tagName !== 'IMG' && target.ignoreError) return;
    target.ignoreError = true;
    target.src = LogoImage;
  },
  true
);
const iconLink = document.createElement('link');
iconLink.rel = 'icon';
iconLink.href = LogoCircleImage;
document.head.appendChild(iconLink);
new MusicConnection(webView2Services.enabled);
</script>

<template>
  <el-container
    class="music-layout"
    direction="vertical"
    :class="webView2Services.enabled ? 'webview-host' : ''"
    :style="
      setting.appTheme.image
        ? `background: url(${setting.appTheme.image}) 50% 50% / cover`
        : ''
    ">
    <el-container
      class="music-layout-top"
      :class="play.musicList.length > 0 ? '' : 'music-layout-top-full'">
      <SideMenu />

      <el-container class="music-layout-right" direction="vertical">
        <Header />
        <el-main class="music-main">
          <RouterView />
          <CurrentList />
        </el-main>
      </el-container>
    </el-container>
    <Footer />
    <PlayDetail />
    <WindowHelper v-if="webView2Services.enabled" />
  </el-container>
</template>

<style lang="less" scoped>
.music-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--music-background);
  .el-main {
    padding: 0;
    margin-top: 5px;
  }
  &-right {
    background: var(--music-sub-background);
  }
  &-top {
    overflow: hidden;
    height: calc(100vh - 80px);
    &-full {
      height: 100vh;
    }
  }
  &-top,
  .music-footer {
    width: 100vw;
  }
}
.music-main {
  position: relative;
  overflow-x: hidden;
}
</style>

<style lang="less">
.music-main > .el-scrollbar > .el-scrollbar__wrap > .el-scrollbar__view {
  position: relative;
  min-height: 100%;
}
</style>
