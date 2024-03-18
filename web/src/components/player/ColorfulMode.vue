<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import Lyric from './Lyric.vue';
import Disc2Image from '../../assets/images/disc3.png';
import SmokeVideo from '../../assets/videos/smoke.webm';
import SmokeRingVideo from '../../assets/videos/smoke-ring.webm';
import { LogoImage } from '../../utils/logo';
import { usePlayStore } from '../../stores/play';
import { useSettingStore } from '../../stores/setting';
import { isIOS } from '@vueuse/core';
interface Props {
  tools?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  tools: true
});

let colorBase = 0;
const play = usePlayStore();
const setting = useSettingStore();
const themeColor = ref('rgb(179, 89, 89)');
function changeColor() {
  if (
    !play.playDetailShow ||
    !play.playStatus.playing ||
    setting.pageValue.disableAnimation
  )
    return;
  colorBase++;
  if (colorBase >= 540) colorBase -= 540;
  const colorPlus = colorBase % 90;
  switch (Math.floor(colorBase / 90)) {
    case 0:
      setColor(179, 89, 89, 0, colorPlus, 0);
      break;
    case 1:
      setColor(179, 179, 89, -colorPlus, 0, 0);
      break;
    case 2:
      setColor(89, 179, 89, 0, 0, colorPlus);
      break;
    case 3:
      setColor(89, 179, 179, 0, -colorPlus, 0);
      break;
    case 4:
      setColor(89, 89, 179, colorPlus, 0, 0);
      break;
    case 5:
      setColor(179, 89, 179, 0, 0, -colorPlus);
      break;
  }
}
function setColor(
  rBase: number,
  gBase: number,
  bBase: number,
  r: number,
  g: number,
  b: number
) {
  themeColor.value = `rgb(${rBase + r}, ${gBase + g}, ${bBase + b})`;
}
let colorInterval: any = null;
onMounted(() => {
  setTimeout(() => {
    const videos = document.getElementsByClassName(
      'music-mode-colorful-video'
    ) as HTMLCollectionOf<HTMLVideoElement>;
    const v1 = videos[0];
    const v2 = videos[1];
    v1?.play();
    v1.playbackRate = 0.8;
    v2.playbackRate = 0.5;
  }, 5000);
  colorInterval = setInterval(changeColor, 100);
});

onUnmounted(() => clearInterval(colorInterval));
</script>
<template>
  <div
    class="music-mode-colorful"
    :style="`--theme-color:${themeColor};--video-alpha:${
      play.playStatus.playing ? 1 : 0
    }`">
    <div class="music-mode-colorful-background"></div>
    <div
      class="music-mode-colorful-background music-mode-colorful-background-second"></div>
    <div
      class="music-mode-colorful-content"
      :style="
        '--animation: ' + (play.playStatus.playing ? 'running' : 'paused')
      ">
      <div>
        <video
          class="music-mode-colorful-video"
          muted
          playsinline
          loop
          :src="SmokeRingVideo"></video>
        <video
          class="music-mode-colorful-video music-mode-colorful-video-running"
          muted
          autoplay
          playsinline
          loop
          :src="SmokeVideo"></video>
        <img class="music-mode-colorful-disc" :src="Disc2Image" />
        <div
          class="music-mode-colorful-disc-background"
          :style="isIOS ? 'opacity: 0.6' : ''"></div>

        <img
          class="music-mode-colorful-album"
          :src="
            play.music.largeImage ||
            play.music.mediumImage ||
            play.music.image ||
            LogoImage
          " />
      </div>
    </div>
    <div
      class="music-mode-colorful-title text-overflow-1"
      :class="props.tools ? '' : 'music-mode-colorful-title-full'">
      <span>
        {{ play.music.name || '' }}{{ play.music.singer && ' - '
        }}{{ play.music.singer }}
      </span>
    </div>
    <div class="music-mode-colorful-lyric">
      <Lyric />
    </div>
  </div>
</template>
<style lang="less" scoped>
.music-mode-colorful {
  height: 100%;
  width: 100%;

  &-background {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background-color: white;
    &-second {
      background-color: var(--theme-color);
      opacity: 0.5;
    }
  }
  &-title {
    color: white;
    position: fixed;
    left: 50%;
    top: 0;
    height: calc(var(--sat) + 80px);
    line-height: calc(var(--sat) + 80px);
    width: calc(100% - 200px);
    text-align: center;
    transform: translateX(-50%);
    transition: width 0.5s;
    opacity: 0;
    & > span {
      font-size: 18px;
    }
    &-full {
      width: 100%;
      padding: 0 10px;
    }

    @media (orientation: portrait) {
      opacity: 1;
    }
  }
  &-content {
    --animation: paused;
    height: auto;
    width: 50%;
    aspect-ratio: 1 / 1;
    max-height: 80vh;
    max-width: 80vh;
    position: absolute;
    left: 25%;
    top: 50%;
    transform: translate(-50%, -50%);
    transform-origin: center;
    & > div {
      width: 100%;
      height: 100%;
      position: relative;
      animation: spin 60s linear infinite;
      animation-play-state: var(--animation);
      & > * {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-origin: center;
        transform: translate(-50%, -50%);
      }
    }
    @media (orientation: portrait) {
      left: 50%;
      width: auto;
      height: 50%;
      max-height: 100vw;
      top: 25%;
    }
  }
  &-lyric {
    width: calc(50% - 20px);
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    color: white;
    @media (orientation: portrait) {
      height: calc(50% - 20px);
      width: 100%;
      bottom: 0;
      top: unset;
      text-align: center;
      :deep(.music-lyric-header) {
        display: none;
      }
    }
  }
  &-disc {
    width: 80%;
    height: 80%;
    &-background {
      width: calc(80% - 8px);
      height: calc(80% - 8px);
      mix-blend-mode: color;
      background-color: var(--theme-color);
      border-radius: 50%;
      opacity: 0.9;
    }
  }
  &-album {
    width: calc(40% - 6px);
    height: calc(40% - 6px);
    border-radius: 50%;
  }
  &-video {
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: var(--video-alpha);
    transition: opacity 5s;
    filter: contrast(0.1) brightness(2);
    &-running {
      transform: translate(-50%, -50%) scale(1.2) !important;
      mask: radial-gradient(
        circle at 50% 50%,
        rgba(0, 0, 0, 1) 50%,
        rgba(0, 0, 0, 0.2) 60%,
        rgba(0, 0, 0, 0.1) 70%,
        rgba(0, 0, 0, 0) 100%
      );
      -webkit-mask: radial-gradient(
        circle at 50% 50%,
        rgba(0, 0, 0, 1) 50%,
        rgba(0, 0, 0, 0.2) 60%,
        rgba(0, 0, 0, 0.1) 70%,
        rgba(0, 0, 0, 0) 100%
      );
    }
  }
}
</style>
