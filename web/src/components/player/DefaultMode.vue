<script lang="ts" setup>
import BlurImage from './BlurImage.vue';
import Jukebox from './Jukebox.vue';
import Lyric from './Lyric.vue';
import { usePlayStore } from '../../stores/play';
const play = usePlayStore();
</script>
<template>
  <div class="music-play-detail-default">
    <BlurImage :src="play.music.image" />
    <div class="music-play-detail-default-jukebox">
      <Jukebox />
    </div>
    <div class="music-play-detail-default-lyric">
      <Lyric />
    </div>
  </div>
</template>
<style lang="less" scoped>
.music-play-detail-default {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: space-evenly;
  &-lyric {
    height: calc(100% - 50px);
    width: 45vw;
    padding-top: 50px;
  }
  &-jukebox {
    height: 100%;
    width: 40vw;
  }
}

@media (max-height: 650px) and (orientation: landscape) {
  .music-play-detail-default {
    &-lyric {
      height: unset;
      padding-top: 0;
      margin-bottom: 10px;
    }
  }
}

@media (max-width: 800px) and (orientation: portrait) {
  .music-play-detail-default {
    flex-direction: column;
    &-lyric {
      height: 50%;
      width: 100%;
      padding: 10px 20px;
    }
    &-jukebox {
      height: 50%;
      width: 100%;
      padding: 10px 20px;
    }
  }
}
</style>
