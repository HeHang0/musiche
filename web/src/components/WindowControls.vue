<script lang="ts" setup>
import { usePlayStore } from '../stores/play';

const play = usePlayStore();
</script>
<template>
  <div class="music-window-controls">
    <span class="music-icon" @click="play.minimize"> 小 </span>
    <span
      v-if="play.windowInfo.maximized"
      class="music-icon"
      @click="play.maximize(false)">
      原
    </span>
    <span v-else class="music-icon" @click="play.maximize(true)"> 大 </span>
    <span class="music-icon" @click="play.close()"> 关 </span>
  </div>
</template>
<style lang="less">
.music-window-controls {
  display: flex;
  align-items: center;
  .music-icon {
    cursor: pointer;
    opacity: 0.8;
    font-size: 12px;
    font-weight: bold;
    margin-left: 10px;
    &:hover {
      opacity: 1;
    }
  }
}
</style>
