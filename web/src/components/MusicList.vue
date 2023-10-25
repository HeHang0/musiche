<script setup lang="ts">
import { useRouter } from 'vue-router';
import { usePlayStore } from '../stores/play';
import { Music } from '../utils/type';
import DefaultImage from '../assets/images/default.png';
interface Props {
  list: Music[];
  single?: boolean;
  search?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  list: () => [],
  single: false,
  search: false
});
const router = useRouter();
function toSinger(music: Music) {
  if (music.type && music.singer) {
    router.push(`/search/${music.type}/${encodeURIComponent(music.singer)}`);
  }
}
function toAlbum(music: Music) {
  if (music.type && music.albumId) {
    console.log(music);
    router.push(`/album/${music.type}/${music.albumId}`);
  }
}
const play = usePlayStore();
</script>
<template>
  <div
    class="music-list"
    :class="props.single ? 'music-list-single' : 'music-list-all'">
    <div class="music-list-header">
      <div class="music-list-header-index">#</div>
      <div class="music-list-header-title">标题</div>
      <div class="music-list-header-album">专辑</div>
      <div class="music-list-header-lover">喜欢</div>
      <div class="music-list-header-duration">时长</div>
    </div>
    <div
      v-for="(item, index) in props.list"
      class="music-list-item"
      :class="
        item.id == play.music.id && item.type == play.music.type
          ? 'music-list-item-is-play'
          : ''
      ">
      <div class="music-list-item-index">
        <span
          v-if="
            play.playStatus.playing &&
            play.music.id == item.id &&
            play.music.type == item.type
          "
          class="music-list-item-index-content">
          <img class="music-list-playing" src="../assets/images/wave.gif" />
        </span>
        <span v-else class="music-list-item-index-content">
          {{ (index + 1).toString().padStart(2, '0') }}
        </span>
        <span
          v-if="
            play.playStatus.playing &&
            play.music.id == item.id &&
            play.music.type == item.type
          "
          class="music-list-item-play music-icon"
          @click="play.pause()">
          停
        </span>
        <span
          v-else
          class="music-list-item-play music-icon"
          @click="play.play(item)">
          播
        </span>
      </div>
      <div class="music-list-item-title">
        <div class="music-list-item-image">
          <img :src="item.image || DefaultImage" />
          <div class="music-list-item-image-single" v-if="props.single">
            <span
              v-if="
                play.playStatus.playing &&
                play.music.id == item.id &&
                play.music.type == item.type
              "
              class="music-list-item-index-content">
              <img
                class="music-list-playing"
                src="../assets/images/wave-white.gif" />
            </span>
            <span
              v-if="
                play.playStatus.playing &&
                play.music.id == item.id &&
                play.music.type == item.type
              "
              class="music-list-item-play music-icon"
              @click="play.pause()">
              停
            </span>
            <span
              v-else
              class="music-list-item-play music-icon"
              @click="play.play(item)">
              播
            </span>
          </div>
        </div>
        <div class="music-list-item-name">
          <div class="music-list-item-name-left">
            <div
              class="music-list-item-name-left-title"
              :title="item.name"
              v-html="(props.search && item.highlightName) || item.name"></div>
            <div class="music-list-item-singer-layout">
              <span v-if="item.vip" class="music-list-item-vip music-icon"
                >V</span
              >
              <div class="music-list-item-singer">
                <span :title="item.singer" @click="toSinger(item)">
                  {{ item.singer }}
                </span>
              </div>
            </div>
          </div>
          <div class="music-list-item-name-operate">
            <span
              class="music-icon"
              @click="play.beforeAddMyPlaylistsMusic([item])"
              title="收藏"
              >收</span
            >
            <span
              class="music-icon"
              @click="play.nextPlay(item)"
              title="下一首播放">
              待
            </span>
            <span
              class="music-icon"
              @click="play.add([item])"
              title="添加到播放列表">
              添
            </span>

            <span v-if="props.single">
              <span
                class="music-icon"
                style="color: red"
                title="喜欢"
                v-if="play.myLover[item.type + item.id]"
                @click="play.addMyLove([item], true)">
                爱
              </span>
              <span
                class="music-icon"
                v-else
                @click="play.addMyLove([item])"
                title="取消喜欢">
                恨
              </span>
            </span>
          </div>
        </div>
      </div>
      <div class="music-list-item-album">
        <span :title="item.album" @click="toAlbum(item)">{{ item.album }}</span>
      </div>
      <div v-if="!props.single" class="music-list-item-lover">
        <span
          class="music-icon"
          style="color: red"
          v-if="play.myLover[item.type + item.id]"
          @click="play.addMyLove([item], true)">
          爱
        </span>
        <span v-else class="music-icon" @click="play.addMyLove([item])">
          恨
        </span>
      </div>
      <div class="music-list-item-duration">{{ item.duration }}</div>
    </div>
  </div>
</template>
<style lang="less" scoped>
.music-list {
  &-playing {
    width: 15px;
    height: 15px;
  }
  &-header {
    display: flex;
    border-bottom: 1px solid var(--music-button-info-border-color);
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    margin-bottom: 8px;
    cursor: default;
    & > div {
      display: flex;
      align-items: center;
      height: 50px;
    }
    .music-list-header-index {
      justify-content: center;
    }
  }
  &-item {
    display: flex;
    &-index-content {
      display: block;
    }
    &-is-play {
      .music-list-item-name-left-title {
        color: var(--music-primary-color);
      }
    }
    &-play {
      display: none;
    }
    & > div {
      display: flex;
      align-items: center;
      height: 66px;
      cursor: default;
      font-size: 13px;
      color: var(--el-text-color-placeholder);
    }
    &-singer > span,
    &-album > span {
      color: black;
      opacity: 0.4;
      cursor: pointer;
      &:hover {
        opacity: 0.6;
      }
    }
    &-lover > span {
      cursor: pointer;
      opacity: 0.8;
      &:hover {
        opacity: 1;
      }
    }
    .music-list-item-index {
      justify-content: center;
    }

    .music-list-item-image {
      position: relative;
      width: 50px;
      height: 50px;
      & .el-skeleton__image,
      & > img {
        width: 100%;
        height: 100%;
        border-radius: var(--music-border-radio);
      }
      &-single {
        border-radius: var(--music-border-radio);
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        & > img {
          width: 15px;
          height: 13px;
        }
      }
    }
    .music-list-item-title {
      .music-list-item-name {
        display: flex;
        margin-left: 10px;
        font-size: 16px;
        color: var(--music-text-color);
        width: calc(100% - 70px);
        &-left {
          width: 100%;
          display: flex;
          flex-direction: column;
          &-title {
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
        &-operate {
          display: none;
        }
        .music-list-item-singer-layout {
          display: flex;
          align-items: center;
        }
        .music-list-item-singer {
          font-size: 13px;
          color: var(--el-text-color-placeholder);
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .music-list-item-vip {
          color: #ff5252;
          margin-right: 5px;
        }
      }
    }
    &:hover {
      .music-list-item-index-content {
        display: none;
      }
      .music-list-item-play {
        display: block;
        cursor: pointer;
      }
      .music-list-item-image > div {
        background-color: rgba(0, 0, 0, 0.2);
      }

      .music-list-item-name-left {
        width: calc(100% - 100px) !important;
      }
      .music-list-item-name-operate {
        width: 100px;
        display: flex !important;
        justify-content: space-evenly;
        align-items: center;
        font-size: 13px;
        color: var(--el-text-color-placeholder);
        & > span {
          cursor: pointer;
        }
      }
    }
  }
}
.music-list-single {
  .music-list-header,
  .music-list-item-index,
  .music-list-item-album {
    display: none;
  }
  .music-list-header-title,
  .music-list-item-title {
    width: calc(100% - 100px);
    margin-left: 20px;
  }
  .music-list-header-duration,
  .music-list-item-duration {
    width: 80px;
  }
  .music-list-item {
    &:hover {
      background-color: rgb(239, 239, 240);
    }
  }
}
.music-list-all {
  padding: 0 10px;
  .music-list-header-index,
  .music-list-item-index {
    width: 50px;
  }
  .music-list-header-lover,
  .music-list-item-lover {
    width: 70px;
    justify-content: center;
  }
  .music-list-header-title,
  .music-list-item-title {
    width: calc(60% - 120px);
  }
  .music-list-header-album,
  .music-list-item-album {
    width: calc(40% - 80px);
  }
  .music-list-header-duration,
  .music-list-item-duration {
    width: 80px;
  }
  .music-list-item {
    &:hover {
      background-color: white;
      border-radius: var(--music-border-radio);
      box-shadow: 0px 0px 8px 0px #9a94945c;
    }
  }
}
</style>
