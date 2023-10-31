<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import { MusicType, Playlist } from '../utils/type';
import PlaylistEle from '../components/Playlist.vue';
import { usePlayStore } from '../stores/play';
import { useSettingStore } from '../stores/setting';
const { currentRoute, replace } = useRouter();
const play = usePlayStore();
const setting = useSettingStore();
const playlist: Ref<Playlist[]> = ref([]);
const loading = ref(false);
const unWatch = watch(currentRoute, getPlaylist);
let total = 0;
async function getYoursList() {
  const type = currentRoute.value.params.type?.toString();
  if (!(type in MusicType)) {
    replace('/yours/' + MusicType.CloudMusic);
    return;
  }
  play.currentMusicType = type as MusicType;
  play.currentMusicTypeShow = true;
  loading.value = true;
  var result = await api.yours(
    play.currentMusicType,
    setting.userInfo[play.currentMusicType].cookie!,
    0
  );
  loading.value = false;
  total = result.total;
  playlist.value.splice(0, playlist.value.length);
  result.list.map((m: Playlist) => playlist.value.push(m));
}
async function getPlaylist() {
  if (currentRoute.value.meta.key == 'yours') {
    getYoursList();
    return;
  }
  if (currentRoute.value.meta.key != 'recommend') return;
  const type = currentRoute.value.params.type?.toString();
  if (!(type in MusicType)) {
    replace('/recommend/' + MusicType.CloudMusic);
    return;
  }
  play.currentMusicType = type as MusicType;
  play.currentMusicTypeShow = true;
  loading.value = true;
  var result = await api.recommend(play.currentMusicType, 0);
  loading.value = false;
  total = result.total;
  console.log(total);
  playlist.value.splice(0, playlist.value.length);
  result.list.map((m: Playlist) => playlist.value.push(m));
}
onMounted(getPlaylist);
onUnmounted(unWatch);
</script>

<template>
  <el-scrollbar class="music-recommend">
    <PlaylistEle :loading="loading" :list="playlist" />
  </el-scrollbar>
</template>

<style lang="less" scoped>
.music-recommend {
  height: 100%;
  padding: 0 var(--music-page-padding-horizontal);
}
</style>
