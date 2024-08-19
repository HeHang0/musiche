<script lang="ts" setup>
import PolarBearImage from '../../assets/images/polar-bear.jpg';
import Disc2Image from '../../assets/images/disc2.png';
import PauseStartVideo from '../../assets/videos/pause-start.webm';
import PausedVideo from '../../assets/videos/paused.webm';
import PlayVideo from '../../assets/videos/play-start.webm';
import PlayingVideo from '../../assets/videos/playing.webm';
import { LogoImage } from '../../utils/logo';
import { usePlayStore } from '../../stores/play';
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import Lyric from './Lyric.vue';
import Snowflakes from 'magic-snowflakes';

interface Props {
  tools?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  tools: true
});

let getSnowflakes = async () => {
  const snowflakes = await import('magic-snowflakes');
  const result = snowflakes.default;
  getSnowflakes = () => Promise.resolve(result);
  return result;
};

const play = usePlayStore();
const videoSrc = ref(play.playStatus.playing ? PlayingVideo : PausedVideo);
const videoLoop = ref(true);
const lyricLine = ref('');
const snowContainer: Ref<HTMLDivElement | undefined> = ref(void 0);
const bearPos = ref({ x: 0, y: 0 });
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
function onLyricLine(_index: number, text: string) {
  lyricLine.value = text;
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
onMounted(async () => {
  const Snow = await getSnowflakes();
  snowflakes = new Snow({
    color: '#ffffffba',
    container: snowContainer.value,
    autoResize: true,
    zIndex: 1
  });
  snowflakes.start();
  setTimeout(snowflakes?.resize.bind(snowflakes), 300);
  calcSeat();
  window.addEventListener('resize', calcSeat);
  play.subscribeLyricLine(onLyricLine);
});
function calcSeat() {
  if (!snowContainer.value) return;
  const screenRatio = window.innerWidth / window.innerHeight;
  const imageRatio = 1924 / 1080;
  let screenHeight = 0;
  let screenWidth = 0;
  let x = 0.44 * 1924;
  let y = 0.79 * 1080;
  if (imageRatio > screenRatio) {
    // 图片比例大于屏幕比例 图片高度铺满
    screenHeight = 1080;
    screenWidth = 1080 * screenRatio;
    x -= (1924 - screenWidth) / 2;
  } else {
    // 图片比例小于屏幕比例 图片宽度铺满
    screenWidth = 1924;
    screenHeight = 1924 / screenRatio;
    y -= (1080 - screenHeight) / 2;
  }
  x /= screenWidth;
  y /= screenHeight;
  if (x > 1) x = 1;
  if (y > 1) y = 1;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  x *= 100;
  y *= 100;
  bearPos.value = { x, y };
}
onUnmounted(() => {
  snowflakes?.destroy();
  window.removeEventListener('resize', calcSeat);
  play.subscribeLyricLine(onLyricLine, true);
});
</script>
<template>
  <div class="music-mode-polar-bear">
    <img
      class="music-mode-polar-bear-background"
      :src="PolarBearImage"
      @load="calcSeat" />
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
    <div
      class="music-mode-polar-bear-title text-overflow-1"
      :class="props.tools ? '' : 'music-mode-polar-bear-title-full'">
      <span>
        {{ play.music.name || '' }}{{ play.music.singer && ' - '
        }}{{ play.music.singer }}
      </span>
      <br />
      {{ lyricLine }}
    </div>
    <video
      class="music-mode-polar-bear-video"
      muted
      autoplay
      playsinline
      :src="videoSrc"
      :loop="videoLoop"
      @ended="onVideoEnd"
      :style="`--x:${bearPos.x}%;--y:${bearPos.y}%`"></video>
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
    top: 0;
    width: calc(100% - 200px);
    text-align: center;
    transform: translateX(-50%);
    opacity: 0;
    margin-top: var(--sat, 20px);
    transition: opacity 0.3s, width 0.3s;
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
    height: 100%;
    width: 50%;
    min-width: min(350px, 30%);
    max-width: min(500px, 80vh);
    max-height: 80vh;
    position: absolute;
    left: 25%;
    transform: translateX(-50%);
    @media (orientation: portrait) {
      left: 50%;
      width: 100%;
      height: 50%;
      transform: translateX(-50%);
      & > div {
        padding: 0 20px;
      }
    }
  }
  &-lyric {
    width: 45%;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    color: white;
    @media (orientation: portrait) {
      display: none;
    }
  }
  &-disc {
    max-width: 100%;
    max-height: 100%;
    animation: spin 60s linear infinite;
  }
  &-album {
    max-width: calc(50% - 10px);
    max-height: calc(50% - 10px);
    position: absolute;
    left: 50%;
    top: calc(50% - 2px);
    transform: translate(-50%, -50%);
    border-radius: 50%;
    mix-blend-mode: hard-light;
  }
  &-video {
    position: fixed;
    left: var(--x);
    top: var(--y);
    width: min(200px, 40vw);
    max-height: 80%;
    pointer-events: none;
    transform-origin: center;
    transform: translate(-50%, -50%) rotateY(0);
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

    @media (orientation: portrait) {
      transform: translate(-50%, -50%) rotateY(180deg);
    }
  }
}
</style>
