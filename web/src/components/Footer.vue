<script setup lang="ts">
import { usePlayStore } from '../stores/play';
import { SortType } from '../utils/type';
import LogoImage from '../assets/images/logo.png';
interface Props {
  full?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  full: false
});
const play = usePlayStore();
</script>
<template>
  <el-footer
    v-show="play.musicList.length > 0"
    class="music-footer"
    :class="props.full ? 'music-footer-full' : ''">
    <div class="music-footer-layout">
      <div v-if="props.full" class="music-footer-layout-left">
        <span
          class="music-icon"
          style="color: red"
          v-if="play.myLover[play.music.type + play.music.id]"
          @click="play.addMyLove([play.music], true)">
          爱
        </span>
        <span class="music-icon" v-else @click="play.addMyLove([play.music])">
          恨
        </span>
        <span class="music-footer-second-text" style="margin-left: 20px">
          {{ play.playStatus.currentTime }}
          &nbsp;/&nbsp;
          {{ play.playStatus.totalTime || play.music.duration }}
        </span>
      </div>
      <div v-else class="music-footer-layout-left">
        <div
          class="music-footer-image"
          @click="play.playDetailShow = true"
          :class="play.playStatus.playing ? 'spinning' : ''">
          <img :src="play.music.image || LogoImage" />
        </div>
        <div class="music-footer-title">
          <div class="music-footer-title-name" :title="play.music.name">
            {{ play.music.name || '' }}
          </div>
          <div class="music-footer-title-singer">
            <span class="music-list-item-vip music-icon" v-if="play.music.vip">
              V
            </span>
            <div :title="play.music.singer">
              {{ play.music.singer || '' }}
            </div>
          </div>
        </div>
      </div>
      <div class="music-footer-layout-center">
        <div class="music-footer-layout-center-operate">
          <span
            v-if="play.sortType == SortType.Order"
            class="music-icon"
            title="顺序播放"
            @click="play.setSortType(SortType.Random)">
            顺
          </span>
          <span
            v-else-if="play.sortType == SortType.Random"
            class="music-icon"
            title="随机播放"
            @click="play.setSortType(SortType.Single)">
            随
          </span>
          <span
            v-else-if="play.sortType == SortType.Single"
            class="music-icon"
            title="单曲循环"
            @click="play.setSortType(SortType.Loop)">
            单
          </span>
          <span
            v-else
            class="music-icon"
            title="列表循环"
            @click="play.setSortType(SortType.Order)">
            环
          </span>
          <span class="music-icon opacity-8" @click="play.last" title="上一首">
            前
          </span>
          <span
            v-if="play.playStatus.playing"
            class="music-icon music-footer-play"
            title="暂停"
            @click="play.pause">
            停
          </span>
          <span
            v-else
            class="music-icon music-footer-play"
            @click="play.play()"
            title="播放">
            播
          </span>
          <span class="music-icon" @click="play.next" title="下一首"> 后 </span>
          <span class="music-icon" title="桌面歌词" style="opacity: 0">
            词
          </span>
        </div>
        <div class="music-footer-layout-center-progress">
          <span v-if="!props.full" class="music-footer-second-text">{{
            play.playStatus.currentTime
          }}</span>
          <el-slider
            class="music-slider-primary"
            :class="
              props.full ? 'music-footer-layout-center-progress-full' : ''
            "
            v-model="play.playStatus.progress"
            :show-tooltip="false"
            :max="1000"
            @mousedown="play.playStatus.disableUpdateProgress = true"
            @change="play.changeProgress" />
          <span v-if="!props.full" class="music-footer-second-text">{{
            play.playStatus.totalTime || play.music.duration
          }}</span>
        </div>
      </div>
      <div class="music-footer-layout-right">
        <el-popover
          :visible="play.currentListPopover.show"
          placement="bottom"
          width="130"
          popper-class="music-footer-popover"
          content="已添加至播放列表"
          :auto-close="2000">
          <template #reference>
            <span
              class="music-icon"
              @click="play.currentListShow = !play.currentListShow"
              @mouseup.stop>
              表
            </span>
          </template>
        </el-popover>
        <span class="music-icon" title="静音" @click="play.mute">
          {{ play.playStatus.volume > 0 ? '音' : '静' }}
        </span>
        <el-slider
          v-model="play.playStatus.volume"
          @change="play.changeVolume"
          :show-tooltip="false"
          style="width: 70px" />
      </div>
    </div>
  </el-footer>
</template>
<style lang="less" scoped>
.music-icon {
  cursor: pointer;
  opacity: 0.6;
  &:hover {
    opacity: 1;
  }
}
.opacity-8 {
  opacity: 0.8;
}
.music-footer {
  background-color: var(--el-fill-color-lighter);
  height: 80px;
  border-top: 1px solid var(--el-border-color);
  &-play {
    display: inline-block;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    line-height: 38px;
    background-color: rgba(0, 0, 0, 0.1);
  }
  &-full {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    border-top: none;
    .music-footer-play {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
  &-second-text {
    font-size: 10px;
    color: var(--el-text-color-placeholder);
  }
  &-layout {
    display: flex;
    align-items: center;
    height: 100%;
    &-left,
    &-right {
      width: 300px;
      display: flex;
      align-items: center;
    }
    &-right {
      justify-content: flex-end;
      & > * + * {
        margin-left: 20px;
      }
    }
    &,
    &-center,
    &-center-progress {
      position: unset;
    }
    &-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
      &-operate {
        text-align: center;
        span + span {
          margin-left: 20px;
        }
      }
      &-progress {
        width: 100%;
        padding: 0 20px;
        display: flex;
        align-items: center;
        & > span:first-child {
          margin-right: 8px;
        }
        & > span:last-child {
          margin-left: 8px;
        }
        &-full {
          position: absolute;
          width: 100%;
          left: 0;
          top: -13px;
          --music-progress-height: 6px;
          --el-slider-runway-bg-color: transparent;
          --music-slider-primary-color: linear-gradient(
            to right,
            var(--music-slider-color-start),
            var(--music-slider-color-end)
          );
          --music-slider-primary-hover-color: linear-gradient(
            to right,
            var(--music-slider-color-start),
            var(--music-slider-color-end)
          );
          :deep(.el-slider__bar) {
            border-radius: 0 var(--el-slider-border-radius)
              var(--el-slider-border-radius) 0;
          }
        }
      }
    }
  }
  &-image {
    width: 60px;
    height: 60px;
    cursor: pointer;
    border: 1px solid #b0b0b0;
    border-radius: 50%;
    background: linear-gradient(to bottom, #515151, #030303, #303030);
    display: flex;
    align-items: center;
    justify-content: center;
    img {
      width: 42px;
      height: 42px;
      border-radius: 50%;
    }
  }
  &-title {
    height: 100%;
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    margin-left: 15px;
    &-name {
      width: 220px;
    }
    &-name,
    &-singer > div {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    &-singer {
      display: flex;
      align-items: center;
      width: 220px;
      span {
        color: #ff5252;
        margin-right: 5px;
        line-height: 12px;
        opacity: 1;
        cursor: default;
      }
      div {
        font-size: 13px;
        color: var(--el-text-color-placeholder);
      }
    }
  }
}
</style>
