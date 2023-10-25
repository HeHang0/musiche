<script setup lang="ts">
import MusicList from './MusicList.vue';
import { usePlayStore } from '../stores/play';
const play = usePlayStore();
</script>

<template>
  <el-drawer
    class="music-current-list"
    v-model="play.currentListShow"
    :with-header="false">
    <div class="music-current-list-header">
      <span class="music-current-list-header-title">
        播放列表
        <span class="music-current-list-header-total">
          {{ play.musicList.length }}
        </span>
      </span>
      <span>
        <span>
          <span class="music-icon">藏</span>
          <span>收藏全部</span>
        </span>
        <span class="music-icon" @click="play.clearMusicList">清空</span>
      </span>
    </div>
    <div class="music-current-list-content">
      <MusicList :list="play.musicList" single />
    </div>
  </el-drawer>
</template>
<style lang="less" scoped>
.music-icon {
  cursor: pointer;
  margin-right: 10px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.music-current-list {
  &-header {
    height: 60px;
    display: flex;
    align-items: center;
    margin: 0 20px;
    justify-content: space-between;
    &-title {
      font-size: 20px;
      font-weight: bold;
    }
    &-total {
      font-size: 14px;
      color: var(--el-text-color-placeholder);
    }
  }

  &-content {
    height: calc(100% - 60px);
    margin-right: 3px;
    overflow-y: auto;
  }
}
</style>
<style lang="less">
.music-current-list {
  width: 400px !important;
  height: calc(100% - 192px) !important;
  background-color: white;
  border-radius: var(--music-border-radio);
  margin-top: 95px;
  .el-drawer__body {
    padding: 0;
  }
}
</style>
