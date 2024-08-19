<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import MusicList from '../components/MusicList.vue';
import { Music, MusicType } from '../utils/type';
import { usePlayStore } from '../stores/play';
import { useSettingStore } from '../stores/setting';
const { currentRoute, replace } = useRouter();
const play = usePlayStore();
const setting = useSettingStore();
const searchTextShow = ref(true);
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const keywords = ref('');
const loading = ref(false);
const unWatch = watch(currentRoute, searchMusic.bind(null, true));
async function searchMusic(clear: boolean = true) {
  if (currentRoute.value.meta.key != 'search') return;
  setting.currentMusicType = currentRoute.value.params.type as MusicType;
  setting.currentMusicTypeShow = true;
  const kw = decodeURIComponent(
    currentRoute.value.params?.keywords?.toString() || ''
  );
  if (!kw) return;
  if (await checkLink(kw)) {
    return;
  }
  loading.value = true;
  keywords.value = kw;
  searchTextShow.value = true;
  var result = await api.search(
    setting.currentMusicType,
    keywords.value,
    musicList.value.length
  );
  total.value = result.total;
  clear && musicList.value.splice(0, musicList.value.length);
  result.list.map((m: Music) => musicList.value.push(m));
  loading.value = false;
}
async function checkLink(link: string) {
  if (!/^(http|https):\/\//.test(link)) return false;
  if (await checkLinkCloud(link)) {
    return true;
  }
}
async function checkLinkCloud(link: string): Promise<boolean> {
  var dataParsed = await api.parseLink(link);
  if (dataParsed != null) {
    if (setting.currentMusicType != dataParsed.type) {
      replace(`/search/${dataParsed.type}/${encodeURIComponent(link)}`);
    } else {
      if (dataParsed.linkType === 'playlist') {
        replace(`/playlist/${dataParsed.type}/${dataParsed.id}`);
      } else {
        setMusic(await api.musicById(setting.currentMusicType, dataParsed.id));
      }
      return true;
    }
  }
  return false;
}
function setMusic(music: Music | null) {
  total.value = 1;
  musicList.value.splice(0, musicList.value.length);
  if (music) {
    musicList.value.push(music);
    keywords.value = `${music.name} - ${music.singer}`;
    searchTextShow.value = false;
  }
}
onMounted(searchMusic);
onUnmounted(unWatch);
</script>

<template>
  <div class="music-search">
    <div class="music-search-header">
      <div>
        <span class="music-search-title">{{ keywords }}</span>
        <span class="music-search-subtitle" v-if="searchTextShow">
          的相关搜索如下，找到{{ total }}首单曲
        </span>
      </div>
      <div>
        <el-button-group>
          <el-button
            type="primary"
            :disabled="loading || musicList.length === 0"
            @click="play.play(undefined, musicList)">
            <span class="music-icon">播</span>
            播放
          </el-button>
          <el-button
            type="primary"
            :disabled="loading || musicList.length === 0"
            @click="
              play.add(musicList);
              play.showCurrentListPopover();
            "
            title="添加到播放列表">
            <span class="music-icon">添</span>
          </el-button>
        </el-button-group>
        <el-button
          type="info"
          :disabled="loading || musicList.length === 0"
          @click="play.beforeAddMyPlaylistsMusic(musicList)">
          <span class="music-icon"> 收 </span>收藏
        </el-button>
      </div>
    </div>
    <el-scrollbar>
      <MusicList :list="musicList" search :loading="loading" />
      <div
        v-if="total > musicList.length && !loading"
        class="load-more"
        @click="searchMusic(false)"></div>
    </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.music-search {
  :deep(.highlight-text) {
    color: var(--music-highlight-color);
  }
  height: 100%;
  display: flex;
  flex-direction: column;
  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    & > div {
      display: flex;
      align-items: center;
    }
    padding: 0 var(--music-page-padding-horizontal);
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
    flex: 1;
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
  }
}
@media (max-width: 800px) {
  .music-search {
    &-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
}
</style>
