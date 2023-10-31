<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import MusicList from '../components/MusicList.vue';
import { Music, MusicType } from '../utils/type';
import { usePlayStore } from '../stores/play';
const { currentRoute, replace } = useRouter();
const play = usePlayStore();
const searchTextShow = ref(true);
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const keywords = ref('');
const loading = ref(false);
const unWatch = watch(currentRoute, searchMusic);
async function searchMusic() {
  if (currentRoute.value.meta.key != 'search') return;
  play.currentMusicType = currentRoute.value.params.type as MusicType;
  play.currentMusicTypeShow = true;
  const kw = decodeURIComponent(
    currentRoute.value.params?.keywords?.toString() || ''
  );
  if (!kw) return;
  if (await checkLink(kw)) {
    return;
  }
  keywords.value = kw;
  searchTextShow.value = true;
  var result = await api.search(play.currentMusicType, keywords.value, 0);
  total.value = result.total;
  musicList.value.splice(0, musicList.value.length);
  result.list.map((m: Music) => musicList.value.push(m));
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
    if (play.currentMusicType != dataParsed.type) {
      replace(`/search/${dataParsed.type}/${encodeURIComponent(link)}`);
    } else {
      if (dataParsed.linkType === 'playlist') {
        replace(`/playlist/${dataParsed.type}/${dataParsed.id}`);
      } else {
        setMusic(await api.musicById(play.currentMusicType, dataParsed.id));
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
