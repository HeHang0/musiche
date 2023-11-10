<script lang="ts" setup>
import BackgroundColor from './BackgroundColor.vue';
import Lyric from './Lyric.vue';
</script>
<template>
  <div class="music-mode-lyric">
    <BackgroundColor />
    <Lyric pure />
  </div>
</template>
<style lang="less" scoped>
.music-mode-lyric {
  height: 100%;
  width: 100%;
}
</style>
