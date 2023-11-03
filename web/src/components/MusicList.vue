<script setup lang="ts">
import { useRouter } from 'vue-router';
import { usePlayStore } from '../stores/play';
import { Music } from '../utils/type';
import LogoImage from '../assets/images/logo.png';
import LogoCircleImage from '../assets/images/logo-circle.png';
import CloudMusicImage from '../assets/images/cloud-music.webp';
import QQMusicImage from '../assets/images/qq-music.png';
import MiguMusicImage from '../assets/images/migu-music.webp';
import { useSettingStore } from '../stores/setting';
interface Props {
  list: Music[];
  loading?: boolean;
  single?: boolean;
  search?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  list: () => [],
  loading: false,
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
const setting = useSettingStore();
</script>
<template>
  <div
    class="music-list"
    :class="props.single ? 'music-list-single' : 'music-list-all'">
    <div class="music-list-header" v-show="loading || props.list.length > 0">
      <div class="music-list-header-index">#</div>
      <div class="music-list-header-title">标题</div>
      <div class="music-list-header-album">专辑</div>
      <div class="music-list-header-lover">喜欢</div>
      <div class="music-list-header-duration">时长</div>
    </div>
    <el-empty
      v-show="!loading && props.list.length === 0"
      :image="LogoCircleImage"
      description="空空如也" />
    <div
      v-for="(item, index) in props.list"
      v-show="!loading"
      class="music-list-item"
      :class="
        item.id == play.music.id && item.type == play.music.type
          ? 'music-list-item-is-play'
          : ''
      "
      @dblclick="
        !props.single
          ? play.play(
              item,
              setting.pageValue.onlyAddMusicListAtDbClick
                ? undefined
                : props.list
            )
          : undefined
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
          <img :src="item.image || LogoImage" />
          <div class="music-list-item-image-type">
            <img v-if="item.type == 'cloud'" :src="CloudMusicImage" />
            <img v-else-if="item.type == 'qq'" :src="QQMusicImage" />
            <img v-else-if="item.type == 'migu'" :src="MiguMusicImage" />
          </div>
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
              @click="play.setNextPlay(item)"
              title="下一首播放">
              待
            </span>
            <span
              v-if="!props.single"
              class="music-icon"
              @click="
                play.add([item]);
                play.showCurrentListPopover();
              "
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
        <span
          class="text-overflow-2"
          :title="item.album"
          @click="toAlbum(item)"
          >{{ item.album }}</span
        >
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
    <el-skeleton animated :loading="loading">
      <template #template>
        <div class="music-list-item">
          <div class="music-list-item-index">
            <el-skeleton-item variant="text"></el-skeleton-item>
          </div>
          <div class="music-list-item-title">
            <el-skeleton-item
              variant="image"
              class="music-list-item-image"></el-skeleton-item>
            <div class="music-list-item-name">
              <el-skeleton-item style="width: 50%"></el-skeleton-item>
              <el-skeleton-item style="width: 30%"></el-skeleton-item>
            </div>
          </div>
          <div class="music-list-item-album">
            <el-skeleton-item variant="text"></el-skeleton-item>
          </div>
          <div class="music-list-item-lover">
            <el-skeleton-item variant="text"></el-skeleton-item>
          </div>
          <div class="music-list-item-index">
            <el-skeleton-item variant="text"></el-skeleton-item>
          </div>
        </div>
      </template>
    </el-skeleton>
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
    // color: var(--el-text-color-placeholder);
    opacity: 0.6;
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
    }
    &-index,
    &-duration,
    &-singer > span,
    &-album > span {
      opacity: 0.6;
    }
    &-singer > span,
    &-album > span {
      cursor: pointer;
      &:hover {
        opacity: 0.8;
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
        border-radius: var(--music-border-radius);
      }
      &-single {
        border-radius: var(--music-border-radius);
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
      &-type {
        position: absolute;
        right: 0;
        bottom: 0;
        height: 15px;
        & > img {
          width: 15px;
          height: 15px;
          border-radius: 50%;
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
          // color: var(--el-text-color-placeholder);
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
      .music-list-item-image > .music-list-item-image-single {
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
      background-color: var(--music-background-hover);
    }
  }
}
.music-list-all {
  padding: 0 10px 10px 10px;
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
      background-color: var(--music-background-hover);
      border-radius: var(--music-border-radius);
      // box-shadow: 0px 0px 8px 0px #9a94945c;
    }
  }
}
.el-skeleton {
  .music-list-item-name {
    height: 100%;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .el-skeleton__text {
    width: 80%;
  }
  .el-skeleton__image {
    border-radius: var(--music-border-radius);
  }
  .music-list-item-index {
    .el-skeleton__text {
      width: var(--el-font-size-small);
    }
  }
}
</style>
