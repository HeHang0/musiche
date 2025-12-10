<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import SideMenu from './components/SideMenu.vue';
import Header from './components/Header.vue';
import Footer from './components/Footer.vue';
import CurrentList from './components/CurrentList.vue';
import PlayDetail from './components/PlayDetail.vue';
import WindowHelper from './components/WindowHelper.vue';
import { MusicConnection } from './stores/connection';
import { usePlayStore } from './stores/play';
import { useSettingStore } from './stores/setting';
import { LogoImage } from './utils/logo';
import { fixPwaForIOS } from './utils/utils';
import { webView2Services } from './utils/files';
import { getProxyAddress, parseHttpProxyAddress } from './utils/http';
const play = usePlayStore();
const setting = useSettingStore();
document.addEventListener(
  'error',
  function (event: ErrorEvent) {
    const target = event.target as any;
    if (target.tagName !== 'IMG' && target.ignoreError) return;
    const proxyAddress = getProxyAddress();
    if (
      target.src?.startsWith('http://') &&
      !target.src?.startsWith(location.origin) &&
      !target.src?.startsWith(proxyAddress)
    ) {
      target.src = target.src.replace('http://', 'https://');
      return;
    }
    if (!target.src?.includes(proxyAddress)) {
      target.src = parseHttpProxyAddress(target.src);
      return;
    }
    target.ignoreError = true;
    target.src = LogoImage;
  },
  true
);
const connection = new MusicConnection();
let rootClass = connection.config.remote ? 'webview-host' : '';
onMounted(() => {
  fixPwaForIOS();
});
</script>

<template>
  <el-container
    class="music-layout"
    direction="vertical"
    :class="rootClass"
    :style="
      setting.appTheme.objectURL
        ? `background: url(${setting.appTheme.objectURL}) 50% 50% / cover`
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
    <WindowHelper v-if="webView2Services.specialService" />
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
    padding-right: calc(var(--sar) / 1.5);
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
  :deep(.el-overlay) {
    z-index: 2001;
  }
}
</style>
