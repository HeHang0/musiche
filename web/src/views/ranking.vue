<script setup lang="ts">
import { ref, onMounted, watch, Ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import MusicTypeEle from '../components/MusicType.vue';
import RadioGroupEle from '../components/RadioGroup.vue';
import MusicList from '../components/MusicList.vue';
import { Music, MusicType, RankingType } from '../utils/type';
import { usePlayStore } from '../stores/play';
const { currentRoute, push, replace } = useRouter();
const play = usePlayStore();
const musicType: Ref<MusicType> = ref(
  currentRoute.value.params.type as MusicType
);
const total = ref(0);
const musicList: Ref<Music[]> = ref([] as Music[]);
const rankingTypes = [
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
];
const rankingType: Ref<RankingType> = ref(
  currentRoute.value.params.ranking as RankingType
);
const unWatch = watch(currentRoute, searchMusic);
function parseParams() {
  if (currentRoute.value.meta.key != 'ranking') return false;
  const type = currentRoute.value.params.type as MusicType;
  const ranking = currentRoute.value.params.ranking as RankingType;
  if (type in MusicType && ranking in RankingType) {
    musicType.value = type as MusicType;
    rankingType.value = ranking as RankingType;
    return true;
  } else if (type in MusicType) {
    replace(`/ranking/${type}/${RankingType.Hot}`);
  } else if (ranking in RankingType) {
    replace(`/ranking/${MusicType.CloudMusic}/${ranking}`);
  } else {
    replace(`/ranking/${MusicType.CloudMusic}/${RankingType.Hot}`);
  }
  return false;
}
async function searchMusic() {
  if (!parseParams()) return;
  var result = await api.ranking(musicType.value, rankingType.value);
  total.value = result.total;
  musicList.value.splice(0, musicList.value.length);
  result.list.map((m: Music) => musicList.value.push(m));
}
function musicTypeChange(type: MusicType) {
  musicType.value = type;
  push(`/ranking/${musicType.value}/${rankingType.value}`);
}
function rankingTypeChange(type: RankingType) {
  rankingType.value = type;
  push(`/ranking/${musicType.value}/${rankingType.value}`);
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
        <MusicTypeEle
          :value="musicType"
          size="large"
          @change="musicTypeChange"
          style="margin-right: 12px" />
        <el-button type="primary" @click="play.play(undefined, musicList)"
          >播放全部</el-button
        >
        <el-button type="info">收藏全部</el-button>
      </div>
    </div>
    <el-scrollbar>
      <MusicList :list="musicList" />
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
