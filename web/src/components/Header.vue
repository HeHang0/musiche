<script setup lang="ts">
import { Ref, onUnmounted, ref, watch } from 'vue';
import { RouteLocationNormalizedLoaded, useRouter } from 'vue-router';
import { Search } from '@element-plus/icons-vue';

import { useSettingStore } from '../stores/setting';
import { MusicType } from '../utils/type';
import { isWindows } from '../utils/utils';
import { webView2Services } from '../utils/files';

import MusicTypeEle from './MusicType.vue';
import WindowControls from './WindowControls.vue';

const { currentRoute, push, back } = useRouter();
const searchKey = ref('');
const setting = useSettingStore();
function startSearch() {
  if (!searchKey.value.trim()) return;
  push(
    `/search/${setting.currentMusicType}/${encodeURIComponent(searchKey.value)}`
  );
}
const canBack: Ref<boolean> = ref(Boolean(history.state.back));
const unWatch = watch(
  () => currentRoute.value.params,
  newValue => {
    if (newValue.keywords) {
      searchKey.value = decodeURIComponent(newValue.keywords.toString() || '');
    }
    canBack.value = Boolean(history.state.back);
  }
);
function changeMusicType(type: MusicType) {
  if (currentRoute.value.params.type) {
    push({
      ...currentRoute.value,
      params: { ...currentRoute.value.params, type }
    } as RouteLocationNormalizedLoaded);
  }
}
onUnmounted(unWatch);
</script>
<template>
  <el-header
    class="music-header"
    :style="setting.currentMusicTypeShow ? '' : '--header-height:40px'">
    <div class="music-header-content">
      <el-button
        v-if="canBack"
        class="music-header-back music-button-pure music-icon"
        @click="back">
        <span style="opacity: 0.8">左</span>
      </el-button>
      <el-input
        class="music-header-search"
        v-model="searchKey"
        placeholder="搜索音乐、歌手、歌词、链接"
        @keyup.enter.native="startSearch"
        clearable>
        <template #prefix>
          <el-icon
            class="el-input__icon music-header-search-icon"
            @click="startSearch">
            <Search />
          </el-icon>
        </template>
      </el-input>
      <MusicTypeEle
        v-show="setting.currentMusicTypeShow"
        :value="setting.currentMusicType"
        size="large"
        @change="changeMusicType" />
    </div>
    <div
      class="music-header-operate"
      v-if="isWindows && webView2Services.specialService">
      <span class="music-icon" @click="push('/setting')" title="设置">
        设
      </span>
      <WindowControls />
    </div>
  </el-header>
</template>
<style lang="less" scoped>
.music-header {
  --header-height: 80px;
  height: calc(var(--header-height) + var(--sat));
  transition: padding 0.5s;
  --el-header-height: 80px;
  --el-header-padding: 0;
  display: flex;
  align-content: center;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--sat, 10px);
  padding-left: var(--music-page-padding-horizontal);
  padding-right: var(--music-page-padding-horizontal);

  &-content {
    display: flex;
    align-items: center;
    min-width: 535px;
    height: 100%;
    width: 100%;
  }
  &-back {
    margin-right: 9px;
    &:hover {
      span {
        opacity: 1 !important;
      }
    }
  }
  &-search {
    width: 320px;
    height: 37px;
    margin-left: 1px;
    :deep(.el-input__wrapper) {
      background: var(--music-search-background);
      &.is-focus {
        background: transparent;
      }
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    &-icon {
      cursor: pointer;
      &:hover {
        color: var(--music-text-color);
      }
    }
  }
  &-operate {
    display: flex;
    .music-icon {
      cursor: pointer;
      opacity: 0.8;
      font-size: 15px;
      font-weight: bold;
      &:hover {
        opacity: 1;
      }
    }
  }
}

@media (max-width: 800px) {
  .music-header {
    min-width: unset;
    &-content {
      min-width: unset;
      flex-wrap: wrap;
    }
    &-search {
      width: calc(100% - 13px);
    }
    button + &-search {
      width: calc(100% - 38px);
    }
    .el-radio-group {
      width: 100%;
      margin-right: 0;
      margin-left: 0;
      :deep(.el-radio-button) {
        flex: 1;
      }
      :deep(.el-radio-button__inner) {
        width: 100%;
        padding: 2px 10px !important;
      }
    }
  }
}
</style>
