<script setup lang="ts">
import { Ref, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../utils/api/api';
import { MusicType, Playlist } from '../utils/type';
import PlaylistEle from '../components/Playlist.vue';
import { useSettingStore } from '../stores/setting';
import { musicTypeAll } from '../utils/platform';
import { useDebounceFn } from '@vueuse/core';
const { currentRoute, replace } = useRouter();
const setting = useSettingStore();
const playlist: Ref<Playlist[]> = ref([]);
const loading = ref(false);
const scrollBar = ref();
const unWatch = watch(currentRoute, getPlaylist.bind(null, true));
const onScroll = useDebounceFn(checkScrollBottom, 200);
let total = 0;
async function prepareRouter(key: string, type: MusicType) {
  if (key == 'yours') {
    for (let i = 0; i < 2; i++) {
      for (let i = 0; i < musicTypeAll.length; i++) {
        if (!musicTypeAll.includes(type) || !setting.userInfo[type].cookie) {
          if (setting.userInfo[musicTypeAll[i]].cookie) {
            replace('/yours/' + musicTypeAll[i]);
            return true;
          }
          replace('/');
          return true;
        }
        if (await api.userInfo(type, setting.userInfo[type].cookie!)) {
          break;
        } else {
          if (typeof setting.userInfo[type].cookie === 'string') {
            setting.userInfo[type].cookie = '';
          } else {
            setting.userInfo[type].cookie = {};
          }
        }
      }
    }
  } else if (key == 'recommend') {
    if (!musicTypeAll.includes(type)) {
      replace('/recommend/cloud');
      return true;
    }
  } else {
    return true;
  }
  return false;
}
async function getPlaylist(clear: boolean = true) {
  if (loading.value) return;
  const type = currentRoute.value.params.type?.toString() as MusicType;
  const key = currentRoute.value.meta.key!.toString();
  if (await prepareRouter(key, type)) {
    return;
  }
  loading.value = true;
  clear && playlist.value.splice(0, playlist.value.length);
  setting.currentMusicType = type as MusicType;
  setting.currentMusicTypeShow = true;
  loading.value = true;
  let result = null;
  if (key === 'yours') {
    result = await api.yours(setting.currentMusicType, playlist.value.length);
  } else {
    result = await api.recommend(
      setting.currentMusicType,
      playlist.value.length
    );
  }
  total = result.total;
  result.list.map((m: Playlist) => playlist.value.push(m));
  loading.value = false;
  if (await needContinueLoading()) getPlaylist(false);
}

async function needContinueLoading() {
  await new Promise(resolve => {
    nextTick(resolve.bind(null, null));
  });
  try {
    return (
      scrollBar.value.wrapRef.children[0].children[0].offsetHeight <
        scrollBar.value.wrapRef.offsetHeight && total > playlist.value.length
    );
  } catch {}
  return false;
}
function checkScrollBottom(e: any) {
  console.log(
    e.scrollTop + scrollBar.value.wrapRef.offsetHeight,
    scrollBar.value.wrapRef.children[0].children[0].offsetHeight
  );
  if (
    total > playlist.value.length &&
    !loading.value &&
    e.scrollTop + scrollBar.value.wrapRef.offsetHeight >
      scrollBar.value.wrapRef.children[0].children[0].offsetHeight - 50
  ) {
    getPlaylist(false);
  }
}
onMounted(getPlaylist);
onUnmounted(unWatch);
</script>

<template>
  <el-scrollbar ref="scrollBar" class="music-recommend" @scroll="onScroll">
    <PlaylistEle :loading="loading" :list="playlist" />
  </el-scrollbar>
</template>

<style lang="less" scoped>
.music-recommend {
  height: 100%;
  padding: 0 var(--music-page-padding-horizontal);
  @media (max-width: 720px), (max-height: 720px) {
    padding: 0 10px;
  }
}
</style>
