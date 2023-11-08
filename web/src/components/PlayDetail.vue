<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useThrottleFn } from '@vueuse/core';

import { usePlayStore } from '../stores/play';
import { ThemeColor } from '../utils/color';
import { webView2Services } from '../utils/utils';

import Footer from './Footer.vue';
import WindowControls from './WindowControls.vue';
import DefaultMode from './player/DefaultMode.vue';
import LyricMode from './player/LyricMode.vue';

const { beforeResolve } = useRouter();
const play = usePlayStore();
const pageElement: Ref<HTMLDivElement | null> = ref(null);
const imageThemeStyle: Ref<string> = ref('');
const fullscreen: Ref<boolean> = ref(Boolean(document.fullscreenElement));
const mouseStillness: Ref<boolean> = ref(false);
const onMouseMove = useThrottleFn(checkMouseStillness, 200);
function setThemeColor() {
  play.music.image &&
    new ThemeColor(play.music.image, color => {
      imageThemeStyle.value = `--music-slider-color-start: ${color.replace(
        ',1)',
        ',0.2)'
      )};--music-slider-color-end: ${color}`;
    });
}
const canFullScreen = Boolean(
  document.body.requestFullscreen ||
    (document.body as any).mozRequestFullScreen ||
    (document.body as any).webkitRequestFullScreen ||
    (document.body as any).msRequestFullscreen
);
const cancelFullScreen =
  document.exitFullscreen ||
  (document as any).mozCancelFullScreen ||
  (document as any).webkitExitFullscreen ||
  (document as any).msExitFullscreen;
function requestFullscreen() {
  if (document.fullscreenElement) {
    cancelFullScreen && cancelFullScreen.call(null);
  } else {
    if (!pageElement.value) return;

    const requestFullscreen =
      pageElement.value.requestFullscreen ||
      (pageElement.value as any).mozRequestFullScreen ||
      (pageElement.value as any).webkitRequestFullScreen ||
      (pageElement.value as any).msRequestFullscreen;
    requestFullscreen && requestFullscreen.call(null);
  }
}
function checkFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement);
}
var mouseStillnessTimeout: any = null;
function setMouseStillness() {
  mouseStillness.value = true;
}
function checkMouseStillness() {
  if (mouseStillness.value) {
    mouseStillness.value = false;
  }
  clearTimeout(mouseStillnessTimeout);
  mouseStillnessTimeout = setTimeout(setMouseStillness, 5000);
}
function setMouseMotion() {
  mouseStillness.value = false;
  clearTimeout(mouseStillnessTimeout);
}
function close() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  play.playDetailShow = false;
}
const unWatch = watch(() => play.music.image, setThemeColor);
onMounted(() => {
  setThemeColor();
  document.addEventListener('fullscreenchange', checkFullscreen);
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', checkFullscreen);
  unWatch();
});
beforeResolve(() => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  if (play.playDetailShow) play.playDetailShow = false;
});
</script>

<template>
  <el-drawer
    class="music-play-detail"
    v-model="play.playDetailShow"
    direction="btt"
    :with-header="false">
    <div
      class="music-play-detail-layout"
      ref="pageElement"
      @mouseleave="checkMouseStillness"
      :style="imageThemeStyle">
      <div
        class="music-play-detail-header"
        @mouseenter="setMouseMotion"
        :style="mouseStillness ? 'opacity:0' : ''">
        <span>
          <el-button class="music-button-pure music-icon" @click="close"
            >下</el-button
          >
          <el-button
            v-if="canFullScreen"
            class="music-button-pure music-icon"
            style="transform: rotateY(180deg)"
            @click="requestFullscreen">
            {{ fullscreen ? '残' : '全' }}
          </el-button>
        </span>
        <div class="music-play-detail-header-right">
          <el-dropdown>
            <el-button class="music-play-detail-header-mode music-button-pure">
              <span class="music-icon">下</span>
              歌词模式
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="play.changePlayerMode('default')"
                  >默认模式</el-dropdown-item
                >
                <el-dropdown-item @click="play.changePlayerMode('lyric')"
                  >纯净模式</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <WindowControls v-if="webView2Services.enabled" />
        </div>
      </div>
      <div class="music-play-detail-body" @mousemove="onMouseMove">
        <LyricMode v-if="play.playerMode == 'lyric'" />
        <DefaultMode v-else />
      </div>
      <div class="music-play-detail-footer" @mouseenter="setMouseMotion">
        <Footer full :style="mouseStillness ? 'opacity:0' : ''" />
      </div>
    </div>
  </el-drawer>
</template>
<style lang="less" scoped>
.music-play-detail-layout {
  position: relative;
  overflow: hidden;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  --music-slider-color-start: rgba(92, 213, 229, 0);
  --music-slider-color-end: rgba(92, 213, 229, 1);
}

.music-play-detail {
  &-header {
    z-index: 2;
    height: 80px;
    display: flex;
    color: white;
    align-items: center;
    justify-content: space-between;
    --el-dropdown-menu-box-shadow: transparent;
    --el-dropdown-menuItem-hover-fill: transparent;
    --el-dropdown-menuItem-hover-color: transparent;
    padding-left: var(--music-page-padding-horizontal);
    padding-right: var(--music-page-padding-horizontal);
    .music-button-pure {
      width: 40px;
      height: 40px;
      color: white;
    }
    .music-play-detail-header-mode {
      width: 100px;
      height: 35px;
      border-radius: 50px;
      .music-icon {
        font-size: 12px;
        margin-right: 5px;
      }
    }
    &-right {
      display: flex;
    }
    .music-window-controls {
      margin-left: 10px;
    }
  }
  &-body {
    z-index: 1;
    height: calc(100% - 160px);
    width: 100%;
    position: relative;
  }
  &-footer {
    z-index: 2;
    height: 80px;
  }
  &-header,
  &-footer .music-footer-full {
    transition: opacity 0.5s;
    opacity: 1;
  }
}
</style>
<style lang="less">
.music-play-detail {
  width: 100% !important;
  height: 100% !important;
  background-color: black;
  box-shadow: none;
  .el-drawer__body {
    padding: 0;
  }
}
</style>
