<script setup lang="ts">
import { RouterView } from 'vue-router';
import SideMenu from './components/SideMenu.vue';
import Header from './components/Header.vue';
import Footer from './components/Footer.vue';
import CurrentList from './components/CurrentList.vue';
import PlayDetail from './components/PlayDetail.vue';
import WindowHelper from './components/WindowHelper.vue';
import { webView2Services } from './utils/utils';
import { usePlayStore } from './stores/play';
import LogoImage from './assets/images/logo.png';
import { MusicConnection } from './stores/connection';
const play = usePlayStore();
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
new MusicConnection(webView2Services.enabled);
</script>

<template>
  <el-container
    class="music-layout"
    direction="vertical"
    :class="webView2Services.enabled ? 'webview-host' : ''">
    <el-scrollbar class="music-root">
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
    </el-scrollbar>
    <PlayDetail />
    <WindowHelper v-if="webView2Services.enabled" />
  </el-container>
</template>

<style lang="less" scoped>
.music-root {
  max-height: 100vh;
  max-width: 100vw;
  overflow: auto;
}
.music-layout {
  height: 100vh;
  width: 100vw;
  overflow: auto;
  .el-main {
    padding: 0;
    margin-top: 5px;
  }
  &-top {
    overflow: hidden;
    height: calc(100vh - 80px);
    min-height: 600px;
    &-full {
      height: 100vh;
    }
  }
  &-top,
  .music-footer {
    width: 100vw;
    min-width: 880px;
  }
  &-right {
    background-color: var(--music-background);
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
.webview-host .music-root > .el-scrollbar__bar {
  &.is-horizontal {
    height: 16px;
  }
  &.is-vertical {
    width: 16px;
  }
}
</style>
