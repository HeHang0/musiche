<script setup lang="ts">
import { Ref, ref } from 'vue';
import { usePlayStore } from '../../stores/play';
import { LogoImage } from '../../utils/logo';
const play = usePlayStore();
const discElement: Ref<HTMLImageElement | null> = ref(null);
let touching = false;
function onTouchStart() {
  touching = true;
  playOrPause();
}
function onClick() {
  if (touching) {
    touching = false;
    return;
  }
  playOrPause();
}
function playOrPause() {
  if (play.playStatus.playing) {
    play.pause();
  } else {
    play.play();
  }
}
</script>
<template>
  <div class="music-jukebox">
    <div class="music-jukebox-disc">
      <img
        ref="discElement"
        class="rotation-animation"
        :class="play.playStatus.playing ? 'rotation-animation-running' : ''"
        src="../../assets/images/disc.png" />
    </div>
    <div class="music-jukebox-album">
      <img
        class="rotation-animation"
        :class="play.playStatus.playing ? 'rotation-animation-running' : ''"
        :src="
          play.music.largeImage ||
          play.music.mediumImage ||
          play.music.image ||
          LogoImage
        " />
    </div>
    <div class="music-jukebox-stylus">
      <img
        @mousedown.stop="onClick"
        @touchstart.stop="onTouchStart"
        :class="play.playStatus.playing ? 'music-jukebox-stylus-playing' : ''"
        src="../../assets/images/stylus.png" />
    </div>
  </div>
</template>
<style lang="less" scoped>
.music-jukebox {
  position: relative;
  height: 100%;
  width: 100%;
  & > div {
    width: 100%;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  &-disc {
    img {
      max-width: 100%;
      max-height: 100%;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      background: #ffffff1a;
      aspect-ratio: 1 / 1;
      transform: rotate(0);
      transition: transform 1s;
      padding: 6px;
    }
  }
  &-album {
    img {
      max-width: 65%;
      max-height: 65%;
      border-radius: 50%;
    }
  }
  &-stylus {
    img {
      max-width: 100%;
      max-height: 100%;
      transition: transform 0.3s linear;
      transform: translateY(calc(-50% - 80px)) rotate(-20deg);
    }
    img.music-jukebox-stylus-playing {
      transform: translateY(calc(-50% - 80px)) rotate(15deg);
    }
  }
}
@media (max-width: 800px), (max-height: 650px) {
  .music-jukebox {
    &-stylus {
      img {
        transform: translateY(calc(-50% - 38px)) rotate(-30deg);
      }
      img.music-jukebox-stylus-playing {
        transform: translateY(calc(-50% - 38px)) rotate(15deg);
      }
    }
  }
}
</style>
