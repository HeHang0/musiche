<script setup lang="ts">
import { Ref, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Search } from '@element-plus/icons-vue';
import { parseMusicType } from '../utils/type';
import { StorageKey, storage } from '../utils/storage';
import WindowControls from './WindowControls.vue';
import { webView2Services } from '../utils/utils';
const { currentRoute, push, back } = useRouter();
const searchKey = ref('');
function startSearch() {
  if (!searchKey.value.trim()) return;
  push(
    `/search/${parseMusicType(
      storage.getValue(StorageKey.SearchMusicType)
    )}/${encodeURIComponent(btoa(searchKey.value))}`
  );
}
const canBack: Ref<boolean> = ref(Boolean(history.state.back));
const unWatch = watch(
  () => currentRoute.value.params,
  newValue => {
    if (newValue.keywords) {
      searchKey.value = atob(newValue.keywords.toString());
    }
    canBack.value = Boolean(history.state.back);
  }
);
onUnmounted(unWatch);
</script>
<template>
  <el-header class="music-header">
    <div>
      <el-button
        :disabled="!canBack"
        class="music-button-pure music-icon music-page-back"
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
    </div>
    <WindowControls v-if="webView2Services.enabled" />
  </el-header>
</template>
<style lang="less" scoped>
.music-page-back {
  &:hover {
    span {
      opacity: 1 !important;
    }
  }
}

.music-header {
  height: 80px;
  transition: padding 0.5s;
  --el-header-height: 80px;
  --el-header-padding: 0;
  display: flex;
  align-content: center;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  padding-left: var(--music-page-padding-horizontal);
  padding-right: var(--music-page-padding-horizontal);
  &-search {
    width: 320px;
    height: 37px;
    margin-left: 10px;
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
}
</style>
