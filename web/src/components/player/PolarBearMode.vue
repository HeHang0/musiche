<script lang="ts" setup>
import PolarBearImage from '../../assets/images/polar-bear.png';
import Disc2Image from '../../assets/images/disc2.png';
import PauseStartVideo from '../../assets/videos/pause-start.webm';
import PausedVideo from '../../assets/videos/paused.webm';
import PlayVideo from '../../assets/videos/play-start.webm';
import PlayingVideo from '../../assets/videos/playing.webm';
import { LogoImage } from '../../utils/logo';
import { usePlayStore } from '../../stores/play';
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import Snowflakes from 'magic-snowflakes';
import Lyric from './Lyric.vue';

const play = usePlayStore();
const videoSrc = ref(play.playStatus.playing ? PlayingVideo : PausedVideo);
const videoLoop = ref(true);
const snowContainer: Ref<HTMLDivElement | undefined> = ref(void 0);
function onVideoEnd(payload: Event) {
  if (!payload.currentTarget) return;
  const target = payload.currentTarget as HTMLVideoElement;
  if (target.src.endsWith(PlayVideo)) {
    videoSrc.value = PlayingVideo;
  } else if (target.src.endsWith(PauseStartVideo)) {
    videoSrc.value = PausedVideo;
  }
  if (!videoLoop.value) videoLoop.value = true;
}
watch(
  () => play.playStatus.playing,
  value => {
    videoSrc.value = value ? PlayVideo : PauseStartVideo;
    videoLoop.value = false;
  }
);
watch(
  () => play.playDetailShow,
  value => {
    if (value)
      snowflakes && setTimeout(snowflakes?.resize.bind(snowflakes), 300);
  }
);
let snowflakes: Snowflakes | null = null;
onMounted(() => {
  snowflakes = new Snowflakes({
    color: '#ffffffba',
    container: snowContainer.value,
    autoResize: true,
    zIndex: 1
  });
  (window as any).snowflakes = snowflakes;
  snowflakes.start();
  setTimeout(snowflakes?.resize.bind(snowflakes), 300);
});
onUnmounted(() => {
  snowflakes?.destroy();
});
</script>
<template>
  <div class="music-mode-polar-bear">
    <img
      class="music-mode-polar-bear-background"
      :src="PolarBearImage"
      alt="" />
    <div class="music-mode-polar-bear-content">
      <div>
        <img
          class="music-mode-polar-bear-disc"
          :src="Disc2Image"
          :style="
            'animation-play-state: ' +
            (play.playStatus.playing ? 'running' : 'paused')
          " />

        <img
          class="music-mode-polar-bear-album"
          :src="
            play.music.largeImage ||
            play.music.mediumImage ||
            play.music.image ||
            LogoImage
          " />
      </div>
    </div>
    <div class="music-mode-polar-bear-title text-overflow-2">
      <span>{{ play.music.name || '' }}</span> <br />
      {{ play.music.singer || '' }}
    </div>
    <video
      class="music-mode-polar-bear-video"
      muted
      autoplay
      playsinline
      :src="videoSrc"
      :loop="videoLoop"
      @ended="onVideoEnd">
      <!-- <source type='video/mp4; codecs="hvc1"' /> -->
      <!-- <source :src="PausedVideo" type="video/webm" /> -->
      <!-- <source
          src="https://rotato.netlify.app/alpha-demo/movie-webm.webm"
          type="video/webm" /> -->
    </video>
    <div class="music-mode-polar-bear-lyric">
      <Lyric />
    </div>

    <div ref="snowContainer" class="music-mode-polar-bear-snow"></div>
  </div>
</template>
<style lang="less" scoped>
.music-mode-polar-bear {
  height: 100%;
  width: 100%;

  &-snow {
    pointer-events: none;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }

  &-background {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  &-title {
    color: white;
    position: fixed;
    left: 50%;
    top: 20px;
    width: calc(100% - 200px);
    text-align: center;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
    & > span {
      font-size: 20px;
    }

    @media (max-width: 800px) {
      opacity: 1;
    }
  }
  &-content {
    height: 100%;
    width: 50%;
    min-width: 350px;
    max-width: 500px;
    position: absolute;
    left: 25%;
    transform: translateX(-50%);
    @media (max-width: 800px) {
      left: 50%;
      transform: translateX(-50%);
      & > div {
        padding: 0 20px;
      }
    }
  }
  &-lyric {
    width: calc(50% - 100px);
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;

    @media (max-width: 800px) {
      display: none;
    }
  }
  &-disc {
    max-width: 100%;
    max-height: 100%;
    animation: spin 60s linear infinite;
  }
  &-album {
    width: calc(50% - 10px);
    height: calc(50% - 10px);
    position: absolute;
    left: 50%;
    top: calc(50% - 2px);
    transform: translate(-50%, -50%);
    border-radius: 50%;
    mix-blend-mode: hard-light;
  }
  &-video {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(200px, 40vw);
    transform-origin: center;
    transform: translate(-125%, max(10vh, 20%)) rotateY(0);
    transition: transform 0.3s linear;
    mask: linear-gradient(
      0,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.5) 25%,
      rgba(0, 0, 0, 0.1) 40%,
      rgba(0, 0, 0, 0) 49.9%,
      rgba(0, 0, 0, 1) 50%,
      rgba(0, 0, 0, 1) 100%
    );
    -webkit-mask: linear-gradient(
      0,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.5) 25%,
      rgba(0, 0, 0, 0.1) 40%,
      rgba(0, 0, 0, 0) 49.9%,
      rgba(0, 0, 0, 1) 50%,
      rgba(0, 0, 0, 1) 100%
    );

    @media (max-width: 800px) {
      left: 50%;
      transform: translate(-95%, max(10vh, 30%)) rotateY(180deg);
    }
  }
}
</style>
