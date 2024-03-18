<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useThrottleFn } from '@vueuse/core';

import { usePlayStore } from '../stores/play';
import { ThemeColorManager } from '../utils/color';
import { isMobile, isWindows, webView2Services } from '../utils/utils';

import Footer from './Footer.vue';
import WindowControls from './WindowControls.vue';
import DefaultMode from './player/DefaultMode.vue';
import LyricMode from './player/LyricMode.vue';
import PolarBearMode from './player/PolarBearMode.vue';
import ColorfulMode from './player/ColorfulMode.vue';
import { updateTheme } from '../utils/http';
import { PlayDetailMode } from '../utils/type';

const { beforeResolve } = useRouter();
const play = usePlayStore();
const pageElement: Ref<HTMLDivElement | null> = ref(null);
const imageThemeStyle: Ref<string> = ref('');
const fullscreen: Ref<boolean> = ref(Boolean(document.fullscreenElement));
const mouseStillness: Ref<boolean> = ref(false);
const onMouseMove = useThrottleFn(checkMouseStillness, 200);
let colorDark = document.documentElement.className.includes('dark');
let popperEle: HTMLStyleElement = document.getElementById(
  'music-play-detail-header-mode-dropdown'
) as HTMLStyleElement;
if (!popperEle) {
  popperEle = document.createElement('style');
  popperEle.id = 'music-play-detail-header-mode-dropdown';
  popperEle.innerText = `:root{--music-slider-color-start: var(--music-button-background-hover);--music-slider-color-end: var(--music-background);}`;
  document.head.appendChild(popperEle);
}
const whiteThemeMode: Set<PlayDetailMode> = new Set(['polar-bear', 'colorful']);
function setThemeColor() {
  if (whiteThemeMode.has(play.playerMode)) {
    imageThemeStyle.value = `--music-slider-color-start: #ffffff10;--music-slider-color-end: #ffffff80;--el-slider-full-background-color: #ffffff2e;--music-full-slider-color: #ffffff80`;
    popperEle.innerText = `:root{${imageThemeStyle.value}}`;
    setTheme();
    return;
  }
  ThemeColorManager.getThemeColor(play.music.image).then(c => {
    if (c == null) return;
    colorDark = c.dark;
    if (whiteThemeMode.has(play.playerMode)) return;
    const colorStart = `rgba(${c.red},${c.green},${c.blue},0.2)`;
    const colorEnd = `rgba(${c.red},${c.green},${c.blue},1)`;
    imageThemeStyle.value = `--music-slider-color-start: ${colorStart};--music-slider-color-end: ${colorEnd}`;
    popperEle.innerText = `:root{${imageThemeStyle.value}}`;
    updateTheme(colorDark ? 2 : 1);
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
    cancelFullScreen && cancelFullScreen.call(document);
  } else {
    if (!pageElement.value) return;
    if (pageElement.value.requestFullscreen)
      pageElement.value.requestFullscreen();
    else if ((pageElement.value as any).mozRequestFullScreen)
      (pageElement.value as any).mozRequestFullScreen();
    else if ((pageElement.value as any).webkitRequestFullScreen)
      (pageElement.value as any).webkitRequestFullScreen();
    else if ((pageElement.value as any).msRequestFullscreen)
      (pageElement.value as any).msRequestFullscreen();
  }
}
function checkFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement);
}
var mouseStillnessTimeout: any = null;
function setMouseStillness() {
  mouseStillness.value = true;
}
let isTouching = false;
function checkMouseStillness() {
  if (isMobile) return;
  if (isTouching) {
    isTouching = false;
    return;
  }
  if (mouseStillness.value) {
    mouseStillness.value = false;
  }
  clearTimeout(mouseStillnessTimeout);
  mouseStillnessTimeout = setTimeout(setMouseStillness, 5000);
}
function setMouseMotion() {
  if (isMobile) return;
  mouseStillness.value = false;
  clearTimeout(mouseStillnessTimeout);
}
function onTouchStart() {
  isTouching = true;
  mouseStillness.value = !mouseStillness.value;
}
function close() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  play.playDetailShow = false;
}
function setTheme() {
  if (play.playDetailShow && whiteThemeMode.has(play.playerMode)) {
    setTimeout(() => {
      updateTheme(2);
    }, 200);
  } else if (!play.playDetailShow) {
    updateTheme(document.documentElement.className.includes('dark') ? 2 : 1);
  } else {
    updateTheme(colorDark ? 2 : 1);
  }
}
const unWatch = watch(() => play.music.image, setThemeColor);
const unWatchPlayerMode = watch(() => play.playerMode, setThemeColor);
onMounted(() => {
  setThemeColor();
  document.addEventListener('fullscreenchange', checkFullscreen);
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', checkFullscreen);
  unWatch();
  unWatchPlayerMode();
});
beforeResolve(() => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  if (play.playDetailShow) play.playDetailShow = false;
});
watch(() => play.playDetailShow, setTheme);
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
        :style="mouseStillness ? 'opacity:0;pointer-events:none' : ''">
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
          <el-dropdown popper-class="music-play-detail-header-mode-dropdown">
            <el-button class="music-play-detail-header-mode music-button-pure">
              <span class="music-icon">下</span>
              歌词模式
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="play.changePlayerMode('default')">
                  默认模式
                </el-dropdown-item>
                <el-dropdown-item @click="play.changePlayerMode('lyric')">
                  纯净模式
                </el-dropdown-item>
                <el-dropdown-item @click="play.changePlayerMode('polar-bear')">
                  极地小熊
                </el-dropdown-item>
                <el-dropdown-item @click="play.changePlayerMode('colorful')">
                  多彩心情
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <WindowControls v-if="isWindows && webView2Services.enabled" />
        </div>
      </div>
      <div
        class="music-play-detail-body"
        :class="mouseStillness ? '' : 'music-play-detail-body-short'"
        @mousemove="onMouseMove"
        @touchstart.stop="onTouchStart">
        <LyricMode v-if="play.playerMode == 'lyric'" />
        <PolarBearMode
          :tools="!mouseStillness"
          v-else-if="play.playerMode == 'polar-bear'" />
        <ColorfulMode
          :tools="!mouseStillness"
          v-else-if="play.playerMode == 'colorful'" />
        <DefaultMode v-else />
      </div>
      <div class="music-play-detail-footer" @mouseenter="setMouseMotion">
        <Footer
          full
          :style="mouseStillness ? 'opacity:0;pointer-events:none' : ''" />
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
  justify-content: space-between;
  --music-slider-color-start: rgba(92, 213, 229, 0);
  --music-slider-color-end: rgba(92, 213, 229, 1);
}

.music-play-detail {
  &-header {
    z-index: 2;
    min-height: 80px;
    display: flex;
    color: white;
    align-items: center;
    justify-content: space-between;
    --el-dropdown-menu-box-shadow: transparent;
    --el-dropdown-menuItem-hover-fill: transparent;
    --el-dropdown-menuItem-hover-color: transparent;
    padding: var(--sat) var(--music-page-padding-horizontal) 0
      var(--music-page-padding-horizontal);
    .music-button-pure {
      width: 35px;
      height: 35px;
      color: white;
    }
    .music-play-detail-header-mode {
      width: 100px;
      height: 35px;
      border-radius: var(--music-infinity);
      .music-icon {
        font-size: 12px;
        margin-right: 5px;
      }
    }
    &-right {
      display: flex;
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
  }
  &-header,
  &-footer .music-footer-full {
    transition: opacity 0.5s;
    opacity: 1;
  }
}

@media (max-height: 650px) and (orientation: landscape) {
  .music-play-detail {
    &-body {
      position: absolute;
      top: 0;
      bottom: 0;
      height: 100%;
      padding-top: var(--sat, 30px);
      padding-right: var(--sar, var(--music-page-padding-horizontal));
      padding-bottom: var(--sat, 20px);
      padding-left: var(--sal, var(--music-page-padding-horizontal));
      :deep(.music-lyric) {
        transition: padding 0.5s;
      }
      :deep(.music-jukebox) {
        height: calc(100% - 80px);
        margin-top: calc(20% - 16px);
      }
      &-short {
        :deep(.music-lyric) {
          padding-bottom: 80px;
        }
      }
    }
  }
}
</style>
<style lang="less">
.music-play-detail {
  width: 100% !important;
  height: 100% !important;
  background-color: black;
  box-shadow: none;
  overflow: hidden;
  .el-drawer__body {
    padding: 0;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden;
  }
}
.music-play-detail-header-mode-dropdown {
  background-color: rgba(0, 0, 0, 0.15) !important;
  border-color: var(--music-button-border-color) !important;
  .el-popper__arrow {
    &::before {
      // background: var(--music-button-border-color) !important;
      // border-color: var(--music-button-border-color) !important;
      // display: none;
      border: none !important;
      background: none !important;
      content: '播';
      color: var(--music-button-border-color);
      transform: rotate(-90deg) translateX(7px) !important;
      transform-origin: bottom;
      font-family: 'icon-font';
    }
  }
  .el-dropdown-menu {
    background: var(--music-slider-color-start) !important;
    .el-dropdown-menu__item {
      color: white !important;
      &:focus,
      &:hover {
        background-color: var(--music-button-border-color) !important;
      }
    }
  }
}
</style>
