<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import RadioGroupEle from '../components/RadioGroup.vue';
import MusicList from '../components/MusicList.vue';
import { Music, MusicType, RankingType } from '../utils/type';
import { usePlayStore } from '../stores/play';
import { useSettingStore } from '../stores/setting';
import { musicTypeAll } from '../utils/platform';
const { currentRoute, push, replace } = useRouter();
const play = usePlayStore();
const setting = useSettingStore();
const loading = ref(false);
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const rankingTypes = ref([
  {
    label: '热歌榜',
    value: RankingType.Hot
  },
  {
    label: '新歌榜',
    value: RankingType.New
  },
  {
    label: '飙升榜',
    value: RankingType.Soar
  }
]);
const rankingType: Ref<RankingType> = ref(
  currentRoute.value.params.ranking as RankingType
);
const unWatch = watch(currentRoute, searchMusic);
function parseParams() {
  if (currentRoute.value.meta.key != 'ranking') return false;
  const type = currentRoute.value.params.type as MusicType;
  const ranking = currentRoute.value.params.ranking as RankingType;
  const inTypeAll = musicTypeAll.includes(type);
  if (inTypeAll && ranking in RankingType) {
    setting.currentMusicType = type as MusicType;
    setting.currentMusicTypeShow = true;
    rankingType.value = ranking as RankingType;
    return true;
  } else if (inTypeAll) {
    replace(`/ranking/${type}/${RankingType.Hot}`);
  } else if (ranking in RankingType) {
    replace(`/ranking/cloud/${ranking}`);
  } else {
    replace(`/ranking/cloud/${RankingType.Hot}`);
  }
  return false;
}
async function searchMusic() {
  if (!parseParams()) return;
  if (setting.currentMusicType === 'migu') {
    rankingTypes.value[2].label = '原创榜';
  } else {
    rankingTypes.value[2].label = '飙升榜';
  }
  loading.value = true;
  var result = await api.ranking(setting.currentMusicType, rankingType.value);
  loading.value = false;
  total.value = result.total;
  musicList.value.splice(0, musicList.value.length);
  result.list.map((m: Music) => musicList.value.push(m));
}
function rankingTypeChange(type: RankingType) {
  rankingType.value = type;
  push(`/ranking/${setting.currentMusicType}/${rankingType.value}`);
}
function favoritePlaylist() {
  const playlistInfo = api.rankingPlaylist(
    setting.currentMusicType,
    rankingType.value
  );
  playlistInfo &&
    play.addMyFavorite(
      [playlistInfo],
      play.myFavorite[playlistInfo.type + playlistInfo.id]
    );
}
onMounted(searchMusic);
onUnmounted(unWatch);
</script>

<template>
  <div class="music-ranking">
    <div class="music-ranking-header">
      <div>
        <RadioGroupEle
          :value="rankingType"
          :menu="rankingTypes"
          @change="rankingTypeChange" />
      </div>
      <div>
        <el-button-group>
          <el-button
            type="primary"
            :disabled="loading"
            @click="play.play(undefined, musicList)">
            <span class="music-icon">播</span>
            播放
          </el-button>
          <el-button
            type="primary"
            :disabled="loading"
            @click="
              play.add(musicList);
              play.showCurrentListPopover();
            "
            title="添加到播放列表">
            <span class="music-icon">添</span>
          </el-button>
        </el-button-group>
        <el-button type="info" :disabled="loading" @click="favoritePlaylist">
          <span class="music-icon">
            {{
              play.myFavorite[
                setting.currentMusicType + 'ranking' + rankingType
              ]
                ? '藏'
                : '收'
            }}
          </span>
          {{
            play.myFavorite[setting.currentMusicType + 'ranking' + rankingType]
              ? '已'
              : ''
          }}收藏
        </el-button>
      </div>
    </div>
    <el-scrollbar>
      <MusicList :loading="loading" :list="musicList" />
    </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.music-ranking {
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
  .el-scrollbar {
    margin-top: 5px;
    height: calc(100% - 50px);
    padding: 0 calc(var(--music-page-padding-horizontal) - 10px);
  }
}
</style>
