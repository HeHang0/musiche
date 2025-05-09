<script setup lang="ts">
import { usePlayStore } from '../stores/play';
import { SortType } from '../utils/type';
import { LogoImage } from '../utils/logo';
import { isMobile } from '../utils/utils';
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
    class="music-footer"
    :class="props.full ? ' music-footer-full' : ''">
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
        <span class="music-footer-second-text">
          {{ play.playStatus.currentTime }}
          &nbsp;/&nbsp;
          {{ play.playStatus.totalTime || play.music.duration }}
        </span>
      </div>
      <div v-else class="music-footer-layout-left">
        <div
          class="music-footer-image"
          @click="play.playDetailShow = true"
          :class="
            play.playStatus.playing
              ? 'rotation-animation rotation-animation-running'
              : ''
          ">
          <img :src="play.music.image || LogoImage" />
        </div>
        <div class="music-footer-title">
          <div
            class="music-footer-title-name text-overflow-1"
            :title="play.music.name">
            {{ play.music.name || '' }}
          </div>
          <div
            class="music-footer-title-singer text-overflow-1"
            :class="play.music.vip ? 'music-footer-title-vip' : ''"
            :title="play.music.singer">
            <span>{{ play.music.singer || '' }}</span>
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
            :class="play.playStatus.loading ? 'music-footer-play-loading' : ''"
            title="暂停"
            @click="play.pause">
            停
          </span>
          <span
            v-else
            class="music-icon music-footer-play"
            :class="play.playStatus.loading ? 'music-footer-play-loading' : ''"
            @click="play.play()"
            title="播放">
            播
          </span>
          <span class="music-icon" @click="play.next()" title="下一首">
            后
          </span>
          <span
            class="music-icon"
            @click="play.showDesktopLyric(!play.desktopLyricShow)"
            title="桌面歌词"
            :style="play.desktopLyricShow ? 'opacity:1' : ''">
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
            @touchstart="play.playStatus.disableUpdateProgress = true"
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
        <template v-if="!isMobile || !play.config.remote">
          <el-popover
            placement="top"
            :width="30"
            popper-class="music-footer-volume-popover"
            popper-style="min-width:0;padding:0;background-color:var(--music-footer-background);padding-top:5px"
            trigger="click">
            <template #reference>
              <span
                class="music-icon music-footer-layout-right-vol-group"
                title="静音">
                {{ play.playStatus.volume > 0 ? '音' : '静' }}
              </span>
            </template>
            <el-slider
              v-model="play.playStatus.volume"
              @mousedown="play.playStatus.disableUpdateVolume = true"
              @touchstart="play.playStatus.disableUpdateVolume = true"
              @change="play.changeVolume"
              vertical
              height="150px"
              :show-tooltip="false"
              style="width: 30px" />
          </el-popover>
          <span
            class="music-icon music-footer-layout-right-vol-icon"
            title="静音"
            @click="play.mute">
            {{ play.playStatus.volume > 0 ? '音' : '静' }}
          </span>
          <el-slider
            class="music-footer-layout-right-vol-slider"
            v-model="play.playStatus.volume"
            @mousedown="play.playStatus.disableUpdateVolume = true"
            @touchstart="play.playStatus.disableUpdateVolume = true"
            @change="play.changeVolume"
            :show-tooltip="false"
            style="width: 70px" />
        </template>
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
  background-color: var(--music-footer-background);
  height: calc(80px + calc(var(--sab) / 1.5));
  width: 100vw;
  border-top: 1px solid var(--music-side-divider-color);
  padding: 0;
  padding-bottom: calc(var(--sab) / 1.5);
  &-play {
    display: inline-block;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    line-height: 38px;
    background-color: rgba(0, 0, 0, 0.1);
    &-loading::before {
      content: ' ';
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: var(--music-text-color);
      animation: spin 2s linear infinite;
      opacity: 0.2;
    }
  }
  &-full {
    padding-bottom: var(--sab);
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    border-top: none;
    .music-footer-play {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
  &-second-text {
    font-size: 10px;
    // color: var(--el-text-color-placeholder);
    opacity: 0.6;
  }
  &-layout {
    display: flex;
    align-items: center;
    height: 100%;
    width: 100%;
    padding: var(--el-footer-padding);
    &-left {
      .music-footer-second-text {
        margin-left: 20px;
      }
    }
    &-left,
    &-right {
      max-width: 300px;
      width: 30%;
      min-width: 150px;
      display: flex;
      align-items: center;
    }
    &-right {
      justify-content: flex-end;
      & > * + * {
        margin-left: 20px;
      }
      &-vol {
        &-group {
          display: none;
        }
        &-icon,
        &-slider {
          display: flex;
        }
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
      min-width: 225px;
      &-operate {
        text-align: center;
        span + span {
          margin-left: 20px;
        }
      }
      &-progress {
        width: 100%;
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
    transition: transform 0.3s linear;
    transform: rotate(0deg);
    animation-play-state: paused;
    img {
      width: 42px;
      height: 42px;
      border-radius: 50%;
    }
  }
  &-title {
    height: 100%;
    // display: flex;
    // align-items: flex-start;
    // flex-direction: column;
    // justify-content: center;
    margin: 0 15px;
    width: calc(100% - 90px);
    &-name {
      width: 100%;
    }
    &-singer {
      width: 100%;
      & > span {
        font-size: 13px;
        opacity: 0.6;
      }
    }
    &-vip {
      padding-left: 25px;
      &::before {
        content: 'V';
        font-family: 'icon-font';
        position: absolute;
        font-size: 24px;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        color: #ff5252;
        opacity: 1;
      }
    }
  }
  :deep(.el-scrollbar__view) {
    overflow-y: hidden;
  }
  :deep(.el-scrollbar__bar.is-vertical) {
    display: none !important;
  }
}
@media (max-width: 800px) or (max-height: 650px) {
  .music-icon {
    &:hover {
      opacity: 0.6;
    }
  }
}
@media (max-width: 800px) {
  .music-footer {
    &-title {
      display: none;
    }
    &-layout {
      &-left {
        width: 60px;
        min-width: unset;
        .music-footer-second-text {
          margin-left: 5px;
          text-align: center;
        }
      }
      &-right {
        width: 60px;
        min-width: unset;
        &-vol {
          &-group {
            display: flex;
          }
          &-icon,
          &-slider {
            display: none;
          }
        }
        * + * {
          margin-left: 6px;
        }
      }
      &-center {
        &-operate {
          span + span {
            margin-left: 10px;
          }
        }
      }
    }
  }
}
</style>
<style lang="less">
.music-footer-volume-popover {
  transform: translateY(10px);
  &::before,
  &::after {
    content: ' ';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: -1;
  }

  &::before {
    background-color: var(--music-background);
    border-radius: var(--el-popover-border-radius);
  }

  &::after {
    background-color: var(--music-footer-background);
    border-radius: var(--el-popover-border-radius);
  }

  .el-popper__arrow {
    display: none;
  }
}
</style>
