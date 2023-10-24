<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { usePlayStore } from '../stores/play';
import { ThemeColor } from '../utils/color';
import { webView2Services } from '../utils/utils';

import DefaultMode from './player/DefaultMode.vue';
import LyricMode from './player/LyricMode.vue';
import WindowControls from './WindowControls.vue';

const { beforeResolve } = useRouter();
const play = usePlayStore();
const pageElement: Ref<HTMLDivElement | null> = ref(null);
const imageThemeStyle: Ref<string> = ref('');
const fullscreen: Ref<boolean> = ref(Boolean(document.fullscreenElement));
function setThemeColor() {
  play.music.image &&
    new ThemeColor(play.music.image, color => {
      imageThemeStyle.value = `--music-slider-color-start: ${color.replace(
        ',1)',
        ',0.2)'
      )};--music-slider-color-end: ${color}`;
    });
}
function requestFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    pageElement.value?.requestFullscreen();
  }
}
function checkFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement);
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
      :style="imageThemeStyle">
      <div class="music-play-detail-header">
        <span>
          <el-button class="music-button-pure music-icon" @click="close"
            >下</el-button
          >
          <el-button
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
      <div class="music-play-detail-body">
        <LyricMode v-if="play.playerMode == 'lyric'" />
        <DefaultMode v-else />

        <el-slider
          class="music-slider-primary"
          v-model="play.playStatus.progress"
          :show-tooltip="false"
          :max="1000"
          @mousedown="play.playStatus.disableUpdateProgress = true"
          style="--music-progress-height: 6px"
          @change="play.changeProgress" />
      </div>
      <div class="music-play-detail-footer"></div>
    </div>
  </el-drawer>
</template>
<style lang="less" scoped>
.music-play-detail-layout {
  position: relative;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  --music-slider-color-start: rgba(92, 213, 229, 0);
  --music-slider-color-end: rgba(92, 213, 229, 1);
}

.music-play-detail {
  &-header {
    z-index: 3;
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
    z-index: 2;
    height: calc(100vh - 160px);
    width: 100vw;
    position: relative;
    .music-slider-primary {
      position: absolute;
      width: 100%;
      left: 0;
      bottom: 0;
      transform: translateY(13px);
      --el-slider-runway-bg-color: transparent;
      --music-slider-primary-color: linear-gradient(
        to right,
        var(--music-slider-color-start),
        var(--music-slider-color-end)
      );
      --music-slider-primary-hover-color: linear-gradient(
        to right,
        var(--music-slider-color-start),
        var(--music-slider-color-end)
      );
    }
  }
  &-footer {
    z-index: 1;
    height: 80px;
  }
}
</style>
<style lang="less">
.music-play-detail {
  width: 100vw !important;
  height: 100vh !important;
  background-color: black;
  box-shadow: none;
  .el-drawer__body {
    padding: 0;
  }
}
</style>
