<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import { usePlayStore } from '../stores/play';
import { Music, MusicType, Playlist } from '../utils/type';
import MusicList from '../components/MusicList.vue';
import { LogoImage } from '../utils/logo';
import DailyImage from '../assets/images/calendar.png';
import { useSettingStore } from '../stores/setting';
const { currentRoute, replace } = useRouter();
const play = usePlayStore();
const setting = useSettingStore();
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const playlistInfo: Ref<Playlist | null> = ref({} as Playlist);
const loading = ref(false);
const playAllButton = ref();
const playlistInfoShow = ref(false);
const affixShow = ref(false);
const unWatch = watch(currentRoute, searchMusic.bind(null, true));
const pageKeys = ['album', 'playlist', 'lover', 'recent', 'created'];
const hideFavoriteKeys = ['lover', 'created'];
async function searchMusic(clear: boolean = true) {
  const routerKey = currentRoute.value.meta.key?.toString() || '';
  if (!pageKeys.includes(routerKey)) return false;
  const localShow = Boolean(currentRoute.value.meta.localShow);
  const musicType: MusicType = currentRoute.value.params.type as any;
  setting.currentMusicTypeShow = false;
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
  if (clear) musicList.value = [];
  playlistInfo.value = null;
  playlistInfoShow.value = routerKey !== 'recent';
  switch (currentRoute.value.meta.key) {
    case 'album':
      loading.value = true;
      result = await api.albumDetail(
        musicType,
        playlistId,
        musicList.value.length
      );
      loading.value = false;
      break;
    case 'playlist':
      loading.value = true;
      if (playlistId === 'daily') {
        await setting.waitLoaded();
      }
      result = await api.playlistDetail(
        musicType,
        playlistId,
        musicList.value.length
      );
      loading.value = false;
      break;
    case 'lover':
      result = {
        list: play.myLoves,
        total: play.myLoves.length,
        playlist: {
          id: 'lover',
          name: '我喜爱的音乐',
          image:
            play.myLoves.length > 0
              ? play.myLoves[0].largeImage ||
                play.myLoves[0].mediumImage ||
                play.myLoves[0].image
              : '',
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
  total.value = result.total;
  if (clear) musicList.value = result.list;
  else result.list.forEach(m => musicList.value.push(m));
  playlistInfo.value = result.playlist;
}
function addMyFavorite() {
  if (playlistInfo.value) {
    play.addMyFavorite(
      [playlistInfo.value],
      play.myFavorite[playlistInfo.value.type + playlistInfo.value.id]
    );
  } else {
    play.beforeAddMyPlaylistsMusic(musicList.value);
  }
}
function onObserve(
  entries: IntersectionObserverEntry[],
  _observer: IntersectionObserver
) {
  if (entries && entries[0]) affixShow.value = !entries[0].isIntersecting;
}
onMounted(() => {
  searchMusic();
  if (playAllButton.value && playAllButton.value.ref) {
    const observer = new IntersectionObserver(onObserve, {
      threshold: 0
    });
    observer.observe(playAllButton.value.ref);
  }
});
onUnmounted(unWatch);
</script>

<template>
  <div
    class="music-playlist"
    :class="playlistInfo ? 'music-playlist-info-show' : ''">
    <el-scrollbar>
      <div class="music-playlist-header">
        <img
          class="music-playlist-header-image"
          v-if="playlistInfoShow && !loading"
          :src="
            playlistInfo?.image ||
            playlistInfo?.musicList?.at(0)?.largeImage ||
            playlistInfo?.musicList?.at(0)?.mediumImage ||
            playlistInfo?.musicList?.at(0)?.image ||
            LogoImage
          " />

        <div
          v-if="playlistInfo?.daily"
          class="music-playlist-header-image-daily">
          <img :src="DailyImage" />
          <span
            v-if="playlistInfo?.daily"
            :style="'color: ' + playlistInfo?.dailyColor"
            >{{ new Date().getDate() }}</span
          >
        </div>
        <el-skeleton
          animated
          :loading="loading"
          class="music-playlist-header-image">
          <template #template>
            <el-skeleton-item variant="image" />
          </template>
        </el-skeleton>
        <div class="music-playlist-header-info">
          <div v-if="playlistInfoShow" v-show="!loading">
            <div class="music-playlist-header-info-name text-overflow-1">
              {{ playlistInfo?.name || '' }}
            </div>
            <el-scrollbar class="music-playlist-header-info-desc">
              <div v-html="playlistInfo?.description || ''"></div>
            </el-scrollbar>
          </div>
          <el-skeleton animated :loading="loading" :row="4"> </el-skeleton>
          <div>
            <el-button-group>
              <el-button
                type="primary"
                ref="playAllButton"
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
              v-if="
                !hideFavoriteKeys.includes(
                  currentRoute.meta?.key?.toString() || ''
                )
              "
              type="info"
              @click="addMyFavorite">
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
      <MusicList :loading="loading" :list="musicList" />
      <div
        v-if="total > musicList.length && !loading"
        class="load-more"
        @click="searchMusic(false)"></div>
    </el-scrollbar>
    <div
      class="music-playlist-header-affix"
      :class="affixShow ? 'music-playlist-header-affix-show' : ''">
      <div class="music-playlist-header-info">
        <div class="music-playlist-header-info-name text-overflow-1">
          {{ playlistInfo?.name || '' }}
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
            v-if="
              !hideFavoriteKeys.includes(
                currentRoute.meta?.key?.toString() || ''
              )
            "
            type="info"
            @click="addMyFavorite">
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
    &-affix {
      position: absolute;
      top: -50px;
      left: 0;
      width: 100%;
      background: var(--music-affix-background);
      z-index: -1;
      opacity: 0;
      transition-duration: 0.8s;
      transition-property: opacity top;
      .music-playlist-header-info {
        margin-left: 0;
        height: unset !important;
        padding: 0 var(--music-page-padding-horizontal) 10px
          var(--music-page-padding-horizontal);
      }
      &-show {
        top: 0;
        z-index: 0;
        opacity: 1;
        backdrop-filter: blur(2px);
      }
    }
    & > div {
      display: flex;
    }
    padding: 0 var(--music-page-padding-horizontal);

    &-image {
      width: 200px;
      height: 200px;
      border-radius: var(--music-border-radius);
      box-shadow: 0px 0px 8px 0px #9a94945c;
      .el-skeleton__image {
        width: 100%;
        height: 100%;
      }
      &-daily {
        width: 100px;
        height: 100px;
        position: absolute;
        left: calc(var(--music-page-padding-horizontal) + 50px);
        top: 50px;
        & > img {
          height: 100%;
          width: 100%;
        }
        & > span {
          font-size: 30px;
          font-weight: bold;
          text-align: center;
          position: absolute;
          left: 50%;
          top: 50%;
          margin-top: 10px;
          transform: translate(-50%, -50%);
        }
      }
    }

    &-info {
      align-items: flex-start;
      flex-direction: column;
      justify-content: space-between;
      margin-left: 20px;
      flex: 1;
      min-width: 0;
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
        height: 100px;
        margin-top: 10px;
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
  & > .el-scrollbar {
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
  & > .el-scrollbar {
    margin-top: 5px;
    height: calc(100% - 225px);
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
  }
}
@media (max-width: 800px) {
  .music-playlist {
    & > .el-scrollbar {
      padding: 0 !important;
    }
  }
}
@media (max-width: 800px) and (orientation: portrait) {
  .music-playlist {
    &-header {
      flex-direction: column;
      align-items: flex-start;
      height: unset !important;
      &-image {
        height: unset;
        width: 100%;
        max-height: 200px;
        max-width: 200px;
      }
      &-info {
        width: 100%;
        height: unset;
        margin-left: 0;
        &-desc {
          display: none;
        }
      }
    }
  }
}
</style>
