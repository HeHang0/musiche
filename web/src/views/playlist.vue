<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import { usePlayStore } from '../stores/play';
import { Music, MusicType, Playlist } from '../utils/type';
import MusicList from '../components/MusicList.vue';
import DefaultImage from '../assets/images/default.png';
const { currentRoute, replace } = useRouter();
const play = usePlayStore();
const musicList: Ref<Music[]> = ref([] as Music[]);
const playlistInfo: Ref<Playlist | null> = ref({} as Playlist);
const unWatch = watch(currentRoute, searchMusic);
const pageKeys = ['album', 'playlist', 'lover', 'recent', 'created'];
const hideFavoriteKeys = ['lover', 'created'];
async function searchMusic() {
  if (!pageKeys.includes(currentRoute.value.meta.key as string)) return false;
  const localShow = Boolean(currentRoute.value.meta.localShow);
  const musicType: MusicType = currentRoute.value.params.type as any;
  const playlistId: string = currentRoute.value.params.id?.toString() ?? '';
  if (!localShow && !playlistId) {
    replace('/');
    return;
  }
  var result: {
    total: number;
    list: Music[];
    playlist: Playlist | null;
  };
  musicList.value = [];
  playlistInfo.value = null;
  switch (currentRoute.value.meta.key) {
    case 'album':
      result = await api.albumDetail(musicType, playlistId);
      break;
    case 'playlist':
      result = await api.playlistDetail(musicType, playlistId);
      break;
    case 'lover':
      result = {
        list: play.myLoves,
        total: play.myLoves.length,
        playlist: {
          id: 'lover',
          name: '我喜爱的音乐',
          image: play.myLoves.length > 0 ? play.myLoves[0].image : '',
          type: 'lover' as any
        }
      };
      break;
    case 'recent':
      result = {
        list: play.musicHistory,
        total: play.musicHistory.length,
        playlist: null
      };
      break;
    case 'created':
      const playlist = play.myPlaylists.find(item => item.id == playlistId);
      result = {
        list: playlist?.musicList || [],
        total: (playlist?.musicList && playlist?.musicList.length) || 0,
        playlist: playlist || null
      };
      break;

    default:
      replace('/');
      return;
  }
  if (!result) return;
  musicList.value = result.list;
  playlistInfo.value = result.playlist;
}
onMounted(searchMusic);
onUnmounted(unWatch);
</script>

<template>
  <div
    class="music-playlist"
    :class="playlistInfo ? 'music-playlist-info-show' : ''">
    <div class="music-playlist-header">
      <div v-if="playlistInfo" class="music-playlist-header-image">
        <img
          :src="
            playlistInfo.image ||
            (playlistInfo.musicList &&
              playlistInfo.musicList[0] &&
              playlistInfo.musicList[0].image) ||
            DefaultImage
          " />
      </div>
      <div class="music-playlist-header-info">
        <div v-if="playlistInfo">
          <div class="music-playlist-header-info-name">
            {{ playlistInfo.name || '' }}
          </div>
          <div
            class="music-playlist-header-info-desc"
            v-html="playlistInfo.description || ''"></div>
        </div>
        <div>
          <el-button-group>
            <el-button type="primary" @click="play.play(undefined, musicList)">
              <span class="music-icon">播</span>
              播放全部
            </el-button>
            <el-button
              type="primary"
              @click="play.add(musicList)"
              title="添加到播放列表">
              <span class="music-icon">添</span>
            </el-button>
          </el-button-group>
          <el-button
            v-if="
              !hideFavoriteKeys.includes(
                currentRoute.meta?.key?.toString() || ''
              )
            "
            type="info"
            @click="
              playlistInfo &&
                play.addMyFavorite(
                  [playlistInfo],
                  play.myFavorite[playlistInfo.type + playlistInfo.id]
                )
            ">
            <span class="music-icon">{{
              playlistInfo &&
              play.myFavorite[playlistInfo.type + playlistInfo.id]
                ? '藏'
                : '收'
            }}</span>
            {{
              playlistInfo &&
              play.myFavorite[playlistInfo.type + playlistInfo.id]
                ? '已'
                : ''
            }}收藏
          </el-button>
        </div>
      </div>
    </div>
    <el-scrollbar>
      <MusicList :list="musicList" />
    </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.music-playlist {
  display: flex;
  flex-direction: column;
  height: 100%;
  &-header {
    display: flex;
    align-items: center;
    & > div {
      display: flex;
    }
    padding: 0 var(--music-page-padding-horizontal);

    &-image > img {
      width: 200px;
      height: 200px;
      border-radius: var(--music-border-radio);
      box-shadow: 0px 0px 8px 0px #9a94945c;
    }

    &-info {
      align-items: flex-start;
      flex-direction: column;
      justify-content: space-between;
      margin-left: 20px;
      flex: 1;
      & > div {
        width: 100%;
      }
      &-name {
        font-size: 24px;
        font-weight: bold;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      &-desc {
        height: 110px;
        overflow-y: auto;
      }
      button {
        height: 45px;
      }
    }
  }
  &-title {
    font-weight: bold;
    font-size: 22px;
  }
  &-subtitle {
    margin-left: 10px;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }
  .el-scrollbar {
    margin-top: 5px;
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
    height: auto;
    flex: 1;
  }
}
.music-playlist.music-playlist-info-show {
  .music-playlist-header {
    height: 220px;
    &-info {
      height: 200px;
    }
  }
  .el-scrollbar {
    margin-top: 5px;
    height: calc(100% - 225px);
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
  }
}
</style>
