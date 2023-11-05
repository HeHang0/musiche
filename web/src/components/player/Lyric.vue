<script setup lang="ts">
import { usePlayStore } from '../../stores/play';
import { Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import { LyricLine } from '../../utils/type';
import {
  duration2Millisecond,
  scrollToElementId,
  parseLyric
} from '../../utils/utils';
import { useRouter } from 'vue-router';
import * as api from '../../utils/api/api';
interface Props {
  pure?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  pure: false
});
const play = usePlayStore();
const musicLyric: Ref<LyricLine[]> = ref([]);
const currentLine: Ref<number> = ref(0);
const lyricLineIdPrefix = 'lyric-line-';
const router = useRouter();
var currentLyricId = '';
function loadLyric() {
  currentLine.value = 0;
  if (!play.music.length && !play.music.duration) {
    return;
  }
  if (currentLyricId == `${play.music.type}${play.music.id}`) return;
  api.lyric(play.music).then(lyric => {
    if (!lyric) {
      musicLyric.value = [];
    } else {
      if (!lyric.lines) {
        lyric.lines = parseLyric(
          lyric.text,
          play.music.length || duration2Millisecond(play.music.duration)
        );
      }
      currentLyricId = `${play.music.type}${play.music.id}`;
      musicLyric.value = lyric.lines || [];
    }
  });
}
function activeLyricLine() {
  if (!play.playDetailShow) return;
  for (let i = 0; i < musicLyric.value.length; i++) {
    const line = musicLyric.value[i];
    if (
      line.progress <= play.playStatus.progress &&
      line.max > play.playStatus.progress
    ) {
      for (let j = i + 1; j < musicLyric.value.length; j++) {
        if (musicLyric.value[j].progress === line.progress) continue;
        else {
          i = j;
          break;
        }
      }

      if (currentLine.value != i) {
        currentLine.value = i;
        scrollToElementId(lyricLineIdPrefix + i, true, true);
      }
      return;
    }
  }
}
function cancelDetail() {
  play.playDetailShow = false;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}
function toSinger() {
  if (play.music.type && play.music.singer) {
    cancelDetail();
    router.push(
      `/search/${play.music.type}/${encodeURIComponent(play.music.singer)}`
    );
  }
}
function toAlbum() {
  if (play.music.type && play.music.albumId) {
    cancelDetail();
    router.push(`/album/${play.music.type}/${play.music.albumId}`);
  }
}
const unWatchProgress = watch(() => play.playStatus.progress, activeLyricLine);
const unWatchMusicId = watch(() => play.music.id, loadLyric);
const unWatchDuration = watch(() => play.music.duration, loadLyric);
onMounted(loadLyric);
onUnmounted(() => {
  unWatchProgress();
  unWatchMusicId();
  unWatchDuration();
});
</script>
<template>
  <div class="music-lyric" :style="pure ? 'text-align: center' : ''">
    <div class="music-lyric-header">
      <div class="music-lyric-name text-overflow-1" :title="play.music.name">
        {{ play.music.name }}
      </div>
      <div
        class="music-lyric-desc"
        v-show="play.music.album || play.music.singer"
        :style="pure ? 'justify-content: center' : ''">
        <div v-if="!props.pure" class="text-overflow-1">
          <span>专辑：</span
          ><span
            class="music-lyric-desc-album"
            @click="toAlbum"
            :title="play.music.album"
            >{{ play.music.album }}</span
          >
        </div>
        <div v-show="play.music.singer" class="text-overflow-1">
          <span>歌手：</span
          ><span
            class="music-lyric-desc-singer"
            @click="toSinger"
            :title="play.music.singer"
            >{{ play.music.singer }}</span
          >
        </div>
      </div>
    </div>
    <div class="music-lyric-content" v-show="musicLyric.length > 0">
      <div
        v-for="(line, index) in musicLyric"
        :id="lyricLineIdPrefix + index"
        :class="index == currentLine ? 'music-lyric-line-active' : ''"
        class="music-lyric-line">
        {{ line.text }}
      </div>
    </div>
  </div>
</template>
<style lang="less" scoped>
.music-lyric {
  height: 100%;
  width: 100%;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  &-header {
    height: 100px;
    font-size: 26px;
  }
  &-desc {
    font-size: 16px;
    display: flex;
    & > div {
      width: 200px;
      & > span {
        opacity: 0.6;
        cursor: default;
      }
    }
    & > div + div {
      margin-left: 20px;
    }
    &-album,
    &-singer {
      &:hover {
        opacity: 1;
        cursor: pointer;
      }
    }
  }
  &-content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    // text-align: center;
    &::-webkit-scrollbar-thumb {
      background-color: transparent;
    }
  }
  &-line {
    opacity: 0.6;
    font-size: 24px;
    line-height: 55px;
    transition-duration: 0.5s;
    transition-property: opacity, font-size;
    &-active {
      opacity: 1;
      font-size: 32px;
      font-weight: bold;
      line-height: 55px;
    }
  }
}
</style>
