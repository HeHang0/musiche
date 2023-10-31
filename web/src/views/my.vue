<script setup lang="ts">
import { onMounted } from 'vue';
function getPlaylist() {}
onMounted(getPlaylist);
</script>

<template>
  <div class="music-my">
    <el-scrollbar> </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.music-my {
  height: 100%;
  &-header {
    display: flex;
    align-items: center;
    padding: 0 var(--music-page-padding-horizontal);
    height: 45px;
  }
  .el-scrollbar {
    margin-top: 5px;
    height: calc(100% - 50px);
    padding: 0 var(--music-page-padding-horizontal);
  }
}
</style>
