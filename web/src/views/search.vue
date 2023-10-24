<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import MusicTypeEle from '../components/MusicType.vue';
import MusicList from '../components/MusicList.vue';
import { Music, MusicType } from '../utils/type';
import { StorageKey, storage } from '../utils/storage';
const { currentRoute, push } = useRouter();
const musicType: Ref<MusicType> = ref(
  currentRoute.value.params.type as MusicType
);
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const keywords = ref('');
const unWatch = watch(currentRoute, searchMusic);
async function searchMusic() {
  if (currentRoute.value.meta.key != 'search') return;
  musicType.value = currentRoute.value.params.type as MusicType;
  keywords.value = decodeURIComponent(
    currentRoute.value.params?.keywords?.toString() || ''
  );
  if (!keywords.value) return;
  storage.setValue(StorageKey.SearchMusicType, musicType.value);
  var result = await api.search(musicType.value, keywords.value, 0);
  total.value = result.total;
  musicList.value.splice(0, musicList.value.length);
  result.list.map((m: Music) => musicList.value.push(m));
}
function musicTypeChange(type: MusicType) {
  musicType.value = type;
  push(`/search/${musicType.value}/${encodeURIComponent(keywords.value)}`);
}
onMounted(searchMusic);
onUnmounted(unWatch);
</script>

<template>
  <div class="music-search">
    <div class="music-search-header">
      <div>
        <span class="music-search-title">{{ keywords }}</span>
        <span class="music-search-subtitle">
          的相关搜索如下，找到{{ total }}首单曲
        </span>
      </div>
      <div>
        <MusicTypeEle
          :value="musicType"
          size="large"
          @change="musicTypeChange"
          style="margin-right: 12px" />
        <el-button type="primary">播放全部</el-button>
        <el-button type="info">收藏全部</el-button>
      </div>
    </div>
    <el-scrollbar>
      <MusicList :list="musicList" search />
    </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.music-search {
  .c_tx_highlight {
    color: var(--music-highlight-color);
  }
  height: 100%;
  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    & > div {
      display: flex;
      align-items: center;
    }
    padding: 0 var(--music-page-padding-horizontal);
    height: 45px;
  }
  &-title {
    font-weight: bold;
    font-size: 22px;
    display: inline;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &-subtitle {
    margin-left: 10px;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }
  .el-scrollbar {
    margin-top: 5px;
    height: calc(100% - 50px);
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
  }
}
</style>
