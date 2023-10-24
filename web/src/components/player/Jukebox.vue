<script setup lang="ts">
import { usePlayStore } from '../../stores/play';
import { Ref, onUnmounted, ref, watch } from 'vue';
const play = usePlayStore();
const discElement: Ref<HTMLImageElement | null> = ref(null);
const spinningStyle: Ref<string> = ref('');
var angle = 0;
function setJukeboxAngle() {
  if (discElement.value && !play.playStatus.playing) {
    var style = window.getComputedStyle(discElement.value);
    var transform = style.getPropertyValue('transform');
    if (!transform || transform.length < 10) return;
    // 解析 transform 属性以获取旋转角度
    var values = transform.substring(7, transform.length - 1).split(',');
    if (values.length < 2) return;
    var a = parseFloat(values[0]);
    var b = parseFloat(values[1]);
    angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
  }
  spinningStyle.value = `--jukebox-spinning-start: ${angle}deg`;
}
const unWatch = watch(() => play.playStatus.playing, setJukeboxAngle);
onUnmounted(unWatch);
</script>
<template>
  <div class="music-jukebox" :style="spinningStyle">
    <div class="music-jukebox-disc">
      <img
        ref="discElement"
        :class="play.playStatus.playing ? 'music-jukebox-spinning' : ''"
        src="../../assets/images/disc.png" />
    </div>
    <div class="music-jukebox-album">
      <img
        :class="play.playStatus.playing ? 'music-jukebox-spinning' : ''"
        :src="play.music.image" />
    </div>
    <div class="music-jukebox-stylus">
      <img
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
  --jukebox-spinning-start: 0deg;
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
      border: 6px solid transparent;
      border-radius: 50%;
      background: rgb(255 255 255 / 10%);
      outline: 2px solid rgb(255 255 255 / 15%);

      transform: rotate(0deg);
      transition: transform 1s;
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
.music-jukebox-disc > img,
.music-jukebox-album > img {
  transform: rotate(var(--jukebox-spinning-start));
}
.music-jukebox-spinning {
  -webkit-animation: jukebox-spinning 30s linear 30s 5 alternate;
  animation: jukebox-spinning 30s linear infinite;
}
@keyframes jukebox-spinning {
  from {
    transform: rotate(var(--jukebox-spinning-start));
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
