<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import RadioGroupEle from '../components/RadioGroup.vue';
import MusicList from '../components/MusicList.vue';
import SearchPlaylistList from '../components/SearchPlaylistList.vue';
import AnimalPage from '../components/AnimalPage.vue';
import { Music, MusicType, PlaylistSearchItem } from '../utils/type';
import { usePlayStore } from '../stores/play';
import { useSettingStore } from '../stores/setting';
const { currentRoute, replace } = useRouter();
const play = usePlayStore();
const setting = useSettingStore();
type SearchResultType = 'music' | 'playlist';
const searchTextShow = ref(true);
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const playlistList: Ref<PlaylistSearchItem[]> = ref([]);
const keywords = ref('');
const loading = ref(false);
const searchType: Ref<SearchResultType> = ref('music');
const searchTypes = ref([
  {
    label: '歌曲',
    value: 'music'
  },
  {
    label: '歌单',
    value: 'playlist'
  }
]);
const unWatch = watch(currentRoute, searchMusic.bind(null, true));
function parseSearchType(): SearchResultType {
  const type = currentRoute.value.params.searchType?.toString();
  return type === 'playlist' ? 'playlist' : 'music';
}
function searchPath(type: MusicType, resultType: SearchResultType, kw: string) {
  return `/search/${type}/${resultType}/${encodeURIComponent(kw)}`;
}
async function searchMusic(clear: boolean = true) {
  if (currentRoute.value.meta.key != 'search') return;
  const kw = decodeURIComponent(
    currentRoute.value.params?.keywords?.toString() || ''
  );
  setting.currentMusicType = currentRoute.value.params.type as MusicType;
  setting.currentMusicTypeShow = true;
  searchType.value = parseSearchType();
  if (!kw) return;
  if (await checkLink(kw)) {
    return;
  }
  loading.value = true;
  keywords.value = kw;
  searchTextShow.value = true;
  const currentSearchType = searchType.value;
  if (clear) {
    musicList.value.splice(0, musicList.value.length);
    playlistList.value.splice(0, playlistList.value.length);
  }
  var result =
    currentSearchType === 'playlist'
      ? await api.searchPlaylist(
          setting.currentMusicType,
          keywords.value,
          playlistList.value.length
        )
      : await api.search(
          setting.currentMusicType,
          keywords.value,
          musicList.value.length
        );
  if (currentSearchType !== searchType.value) {
    return;
  }
  total.value = result.total;
  if (currentSearchType === 'playlist') {
    result.list.map(m => playlistList.value.push(m as PlaylistSearchItem));
  } else {
    result.list.map(m => musicList.value.push(m as Music));
  }
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
      replace(searchPath(dataParsed.type, 'music', link));
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
  searchType.value = 'music';
  total.value = 1;
  musicList.value.splice(0, musicList.value.length);
  playlistList.value.splice(0, playlistList.value.length);
  if (music) {
    musicList.value.push(music);
    keywords.value = `${music.name} - ${music.singer}`;
    searchTextShow.value = false;
  }
}
function searchTypeChange(type: SearchResultType) {
  if (searchType.value === type) return;
  replace(searchPath(setting.currentMusicType, type, keywords.value));
}
function currentListLength() {
  return searchType.value === 'playlist'
    ? playlistList.value.length
    : musicList.value.length;
}
onMounted(searchMusic);
onUnmounted(unWatch);
</script>

<template>
  <AnimalPage>
    <div class="music-search">
      <div class="music-search-header">
        <div>
          <span class="music-search-title">{{ keywords }}</span>
          <span class="music-search-subtitle" v-if="searchTextShow">
            的相关搜索如下，找到{{ total
            }}{{ searchType === 'playlist' ? '个歌单' : '首单曲' }}
          </span>
        </div>
        <div>
          <RadioGroupEle
            :value="searchType"
            :menu="searchTypes"
            @change="searchTypeChange" />
          <el-button-group v-if="searchType === 'music'">
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
            v-if="searchType === 'music'"
            type="info"
            :disabled="loading || musicList.length === 0"
            @click="play.beforeAddMyPlaylistsMusic(musicList)">
            <span class="music-icon"> 收 </span>收藏
          </el-button>
        </div>
      </div>
      <el-scrollbar>
        <MusicList
          v-if="searchType === 'music'"
          :list="musicList"
          search
          :loading="loading" />
        <SearchPlaylistList
          v-else
          :list="playlistList"
          :loading="loading" />
        <div
          v-if="total > currentListLength() && !loading"
          class="load-more"
          @click="searchMusic(false)"></div>
      </el-scrollbar>
    </div>
  </AnimalPage>
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
    .el-radio-group {
      margin-left: 0;
      margin-right: 10px;
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
      & > div:last-child {
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .el-radio-group {
        margin-bottom: 5px;
      }
    }
  }
}
</style>
