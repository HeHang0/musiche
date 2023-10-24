<script setup lang="ts">
import { Ref, ref } from 'vue';
import { MusicType } from '../utils/type';
import MusicTypeEle from '../components/MusicType.vue';

const musicType: Ref<MusicType> = ref(MusicType.CloudMusic);
function musicTypeChange(type: MusicType) {
  musicType.value = type;
  getPlaylist();
}
function getPlaylist() {}
</script>

<template>
  <div class="music-my">
    <div class="music-my-header">
      <MusicTypeEle
        :value="musicType"
        size="large"
        @change="musicTypeChange"
        style="margin-right: 12px" />
    </div>
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
