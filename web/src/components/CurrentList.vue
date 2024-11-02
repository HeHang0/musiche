<script setup lang="ts">
import { ElMessageBox } from 'element-plus';
import MusicList from './MusicList.vue';
import { usePlayStore } from '../stores/play';
import { scrollToElement } from '../utils/utils';
import { ref } from 'vue';
const play = usePlayStore();
const portrait = window.matchMedia('(orientation: portrait)');
const drawerDirection = ref(portrait.matches ? 'btt' : 'rtl');
portrait.addEventListener('change', () => {
  drawerDirection.value = portrait.matches ? 'btt' : 'rtl';
});
function clear() {
  ElMessageBox.confirm('', '确定要清空播放列表吗？', {
    closeOnClickModal: false,
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(() => {
      play.clearMusicList();
    })
    .catch(() => {});
}
function onOpen() {
  const index = play.musicList.findIndex(
    item => item.id === play.music?.id && item.type == play.music?.type
  );
  if (index < 0) return;
  const elements = document.querySelectorAll(
    '.music-current-list-content .music-list-item'
  );
  scrollToElement(elements.item(index) as HTMLElement, false, true);
}
</script>

<template>
  <el-drawer
    class="music-current-list"
    v-model="play.currentListShow"
    :with-header="false"
    @opened="onOpen"
    :direction="drawerDirection">
    <div class="music-current-list-header">
      <span class="music-current-list-header-title">
        播放列表
        <span class="music-current-list-header-total">
          {{ play.musicList.length }}
        </span>
      </span>
      <span>
        <span class="music-current-list-operate-item">
          <span class="music-icon">收</span>
          <span
            class="music-current-list-operate"
            @click="play.beforeAddMyPlaylistsMusic(play.musicList)"
            >收藏全部</span
          >
        </span>
        <span class="music-current-list-operate-item" @click="clear">
          <span class="music-icon">删</span>
          <span class="music-current-list-operate">清空</span>
        </span>
      </span>
    </div>
    <el-scrollbar class="music-current-list-content">
      <MusicList :list="play.musicList" single />
    </el-scrollbar>
  </el-drawer>
</template>
<style lang="less" scoped>
.music-icon,
.music-current-list-operate {
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  font-weight: normal;
  &-item + &-item {
    margin-left: 20px;
  }
}
.music-icon + span {
  margin-left: 3px;
}
.music-current-list {
  &-header {
    height: 60px;
    display: flex;
    align-items: center;
    padding: 0 calc(var(--sar) + 20px) 0 calc(var(--sal) + 20px);
    justify-content: space-between;
    background-color: var(--music-sub-background);
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
    background-color: var(--music-sub-background);
    .music-list {
      padding: 0 var(--sar) var(--sab) var(--sal);
    }
  }
}
</style>
<style lang="less">
.music-current-list {
  width: 400px !important;
  max-width: 100% !important;
  height: calc(100% - 192px) !important;
  min-height: 80% !important;
  border-radius: var(--music-border-radius);
  margin-top: min(10%, 96px);
  // top: 50% !important;
  // transform: translateY(-50%);
  @media (orientation: portrait) {
    width: 100% !important;
    height: 50% !important;
    min-height: 60% !important;
    margin-top: 0;
    bottom: 0;
    border-radius: var(--music-border-radius) var(--music-border-radius) 0 0;
  }
  @media (max-height: 600px) and (orientation: landscape) {
    height: calc(100% - 80px - calc(var(--sab) / 1.5)) !important;
    margin-top: 0;
    border-radius: var(--music-border-radius) 0 var(--music-border-radius)
      var(--music-border-radius);
  }
  .el-drawer__body {
    padding: 0;
  }
}
</style>
