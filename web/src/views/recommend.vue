<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import { MusicType, Playlist } from '../utils/type';
import MusicTypeEle from '../components/MusicType.vue';
import PlaylistEle from '../components/Playlist.vue';
const { currentRoute, push, replace } = useRouter();
const musicType: Ref<MusicType> = ref(
  currentRoute.value.params.type as MusicType
);
const playlist: Ref<Playlist[]> = ref([]);
const unWatch = watch(currentRoute, getPlaylist);
function musicTypeChange(type: MusicType) {
  musicType.value = type;
  push('/recommend/' + musicType.value);
}
let total = 0;
async function getPlaylist() {
  if (currentRoute.value.meta.key != 'recommend') return;
  const type = currentRoute.value.params.type?.toString();
  if (!(type in MusicType)) {
    replace('/recommend/' + MusicType.CloudMusic);
    return;
  }
  musicType.value = type as MusicType;
  var result = await api.recommend(musicType.value, 0);
  total = result.total;
  console.log(total);
  playlist.value.splice(0, playlist.value.length);
  result.list.map((m: Playlist) => playlist.value.push(m));
}
onMounted(getPlaylist);
onUnmounted(unWatch);
</script>

<template>
  <div class="music-recommend">
    <div class="music-recommend-header">
      <MusicTypeEle
        :value="musicType"
        size="large"
        @change="musicTypeChange"
        style="margin-right: 12px" />
    </div>
    <el-scrollbar>
      <PlaylistEle :list="playlist" />
    </el-scrollbar>
  </div>
</template>

<style lang="less" scoped>
.music-recommend {
  height: 100%;
  &-header {
    display: flex;
    align-items: center;
    padding: 0 var(--music-page-padding-horizontal);
    height: 45px;
  }
  .el-scrollbar {
    margin-top: 5px;
    height: calc(100% - 50px);
    padding: 0 var(--music-page-padding-horizontal);
  }
}
</style>
