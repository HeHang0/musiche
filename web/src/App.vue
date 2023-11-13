<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import SideMenu from './components/SideMenu.vue';
import Header from './components/Header.vue';
import Footer from './components/Footer.vue';
import CurrentList from './components/CurrentList.vue';
import PlayDetail from './components/PlayDetail.vue';
import WindowHelper from './components/WindowHelper.vue';
import { webView2Services } from './utils/utils';
import { MusicConnection } from './stores/connection';
import { usePlayStore } from './stores/play';
import { useSettingStore } from './stores/setting';
import { LogoImage } from './utils/logo';
import { fixPwaForIOS } from './utils/utils';
import { registerServiceWorker } from './sw/register';
registerServiceWorker();

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
new MusicConnection(webView2Services.enabled);
let rootClass = webView2Services.enabled ? 'webview-host' : '';
onMounted(fixPwaForIOS);
</script>

<template>
  <el-container
    class="music-layout"
    direction="vertical"
    :class="rootClass"
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
    <Footer v-show="play.musicList.length > 0" />
    <PlayDetail />
    <WindowHelper v-if="webView2Services.enabled" />
  </el-container>
</template>

<style lang="less" scoped>
.music-layout {
  height: 100%;
  width: 100%;
  overflow: hidden;
  .el-main {
    padding: 0;
    margin-top: 5px;
    padding-right: calc(env(safe-area-inset-right, 0) / 1.5);
  }
  &-right {
    background: var(--music-sub-background);
  }
  &-top {
    overflow: hidden;
    flex: 1;
  }
  &-top {
    width: 100%;
  }
}
.music-main {
  position: relative;
  overflow-x: hidden;
  :deep(.el-scrollbar > .el-scrollbar__wrap > .el-scrollbar__view) {
    position: relative;
    min-height: 100%;
  }
}
</style>
