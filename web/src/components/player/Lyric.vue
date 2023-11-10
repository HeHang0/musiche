<script setup lang="ts">
import { usePlayStore } from '../../stores/play';
import { Ref, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { clearArray, scrollToElementId } from '../../utils/utils';
import { useRouter } from 'vue-router';
interface Props {
  pure?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  pure: false
});
const play = usePlayStore();
const musicLyric: Ref<string[]> = ref([]);
const currentLine: Ref<number> = ref(0);
const lyricLineIdPrefix = 'lyric-line-';
const router = useRouter();
function loadLyric(lines: string[]) {
  clearArray(musicLyric.value);
  musicLyric.value = lines;
}
function activeLyricLine(index: number, _text: string) {
  if (currentLine.value != index) {
    currentLine.value = index;
    nextTick(() => {
      scrollToElementId(lyricLineIdPrefix + index, true, true);
    });
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
onMounted(() => {
  play.subscribeLyric(loadLyric);
  play.subscribeLyricLine(activeLyricLine);
});
onUnmounted(() => {
  play.subscribeLyric(loadLyric, true);
  play.subscribeLyricLine(activeLyricLine, true);
});
</script>
<template>
  <div class="music-lyric" :class="props.pure ? 'music-lyric-pure' : ''">
    <div class="music-lyric-header">
      <div class="music-lyric-name text-overflow-1" :title="play.music.name">
        {{ play.music.name }}
      </div>
      <div
        class="music-lyric-desc"
        v-show="play.music.album || play.music.singer"
        :style="props.pure ? 'justify-content: center' : ''">
        <div v-if="play.music.album" class="text-overflow-1">
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
      <div class="music-lyric-line">&nbsp;</div>
      <div
        v-for="(line, index) in musicLyric"
        :id="lyricLineIdPrefix + index"
        :class="index == currentLine ? 'music-lyric-line-active' : ''"
        class="music-lyric-line">
        {{ line }}
      </div>
      <div class="music-lyric-line">&nbsp;</div>
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
  padding: var(--music-page-padding-horizontal);
  &-pure {
    text-align: center;
  }
  &-header {
    height: 100px;
    font-size: 26px;
  }
  &-desc {
    font-size: 16px;
    display: flex;
    & > div {
      max-width: 200px;
      text-align: left;
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
    -webkit-mask: linear-gradient(
      0,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 1) 15%,
      rgba(0, 0, 0, 1) 85%,
      rgba(0, 0, 0, 0) 100%
    );
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
@media (max-width: 800px) {
  .music-lyric {
    &-header {
      height: unset;
      margin-bottom: 10px;
    }
  }
}
</style>
