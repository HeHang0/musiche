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
    width: 40vw;
    padding-top: 50px;
  }
  &-jukebox {
    height: 100%;
    width: 40vw;
  }
}
</style>
