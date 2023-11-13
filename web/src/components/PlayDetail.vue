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
let popperEle: HTMLStyleElement = document.getElementById(
  'music-play-detail-header-mode-dropdown'
) as HTMLStyleElement;
if (!popperEle) {
  popperEle = document.createElement('style');
  popperEle.id = 'music-play-detail-header-mode-dropdown';
  popperEle.innerText = `:root{--music-slider-color-start: var(--music-button-background-hover);--music-slider-color-end: var(--music-background);}`;
  document.head.appendChild(popperEle);
}

function setThemeColor() {
  play.music.image &&
    new ThemeColor(play.music.image, color => {
      imageThemeStyle.value = `--music-slider-color-start: ${color.replace(
        ',1)',
        ',0.2)'
      )};--music-slider-color-end: ${color}`;
      popperEle.innerText = `:root{${imageThemeStyle.value}}`;
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
          <el-dropdown popper-class="music-play-detail-header-mode-dropdown">
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
      <div
        class="music-play-detail-body"
        :class="mouseStillness ? '' : 'music-play-detail-body-short'"
        @mousemove="onMouseMove"
        @touchstart.stop="onTouchStart">
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
  justify-content: space-between;
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
    padding: env(safe-area-inset-top, 0) var(--music-page-padding-horizontal) 0
      var(--music-page-padding-horizontal);
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

@media (max-height: 800px) and (orientation: landscape) {
  .music-play-detail {
    &-body {
      position: absolute;
      top: 0;
      bottom: 0;
      height: 100%;
      padding-top: max(env(safe-area-inset-top, 0), 30px);
      padding-right: env(
        safe-area-inset-right,
        var(--music-page-padding-horizontal)
      );
      padding-bottom: env(safe-area-inset-bottom, 20px);
      padding-left: env(
        safe-area-inset-left,
        var(--music-page-padding-horizontal)
      );
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
  .el-drawer__body {
    padding: 0;
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
