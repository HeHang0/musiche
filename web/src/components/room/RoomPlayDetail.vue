<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import type { RoomChatMessage, RoomSnapshot } from '../../utils/room';
import type { PlayDetailMode } from '../../utils/type';
import { usePlayStore } from '../../stores/play';
import { isMobile } from '../../utils/utils';
import ParticleStage from '../particle/ParticleStage.vue';
import WindowControls from '../WindowControls.vue';
import { webView2Services } from '../../utils/files';
import Footer from '../Footer.vue';
import DefaultMode from '../player/DefaultMode.vue';
import LyricMode from '../player/LyricMode.vue';
import PolarBearMode from '../player/PolarBearMode.vue';
import ColorfulMode from '../player/ColorfulMode.vue';
import { providePlaybackController } from '../player/playbackContext';
import { useRoomPlaybackController } from './useRoomPlaybackController';

type RoomCurrent = RoomSnapshot['state']['current'];
const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  snapshot: RoomSnapshot;
  current: RoomCurrent | null;
  lyric: string;
  lyricsText: string;
  position: number;
  duration: number;
  volume: number;
  playing: boolean;
  loading?: boolean;
  audio?: HTMLAudioElement | null;
  currentAvatar?: string;
  avatarResolver?: (memberId: string, avatar?: string) => string;
  songPickerOpen?: boolean;
  chatMessages: RoomChatMessage[];
}>();

const emit = defineEmits<{
  share: [];
  togglePlay: [];
  next: [];
  toggleRandom: [];
  seek: [position: number];
  setVolume: [volume: number];
  resume: [];
  removeQueue: [id: string];
  pinQueue: [id: string];
  addQueue: [music: RoomSnapshot['state']['queue'][number]['music']];
  patMember: [memberId: string];
  editProfile: [];
  requestSong: [];
  sendChat: [text: string, image?: string, avatar?: string];
}>();

const play = usePlayStore();
const pageElement = ref<HTMLDivElement | null>(null);
const fullscreen = ref(Boolean(document.fullscreenElement));
const mouseStillness = ref(false);
let mouseStillnessTimer: ReturnType<typeof setTimeout> | null = null;
let isTouching = false;
const mode = computed(() => play.playerMode as PlayDetailMode);
const footerVisible = computed(() => mode.value !== 'particle');
const onMouseMove = useThrottleFn(checkMouseStillness, 200);

const playbackController = useRoomPlaybackController({
  current: () => props.current,
  position: () => props.position,
  duration: () => props.duration,
  volume: () => props.volume,
  playing: () => props.playing,
  loading: () => Boolean(props.loading),
  random: () => props.snapshot.state.randomPlayback,
  active: () => open.value,
  isAdmin: () => props.snapshot.isAdmin,
  lyricsText: () => props.lyricsText,
  lyric: () => props.lyric,
  togglePlay: () => emit('togglePlay'),
  resume: () => emit('resume'),
  next: () => emit('next'),
  toggleRandom: () => emit('toggleRandom'),
  seek: position => emit('seek', position),
  setVolume: volume => emit('setVolume', volume)
});
providePlaybackController(playbackController);

function checkMouseStillness() {
  if (isMobile) return;
  if (isTouching) {
    isTouching = false;
    return;
  }
  mouseStillness.value = false;
  if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
  mouseStillnessTimer = setTimeout(() => (mouseStillness.value = true), 5000);
}

function setMouseMotion() {
  if (isMobile) return;
  mouseStillness.value = false;
  if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
}

function onTouchStart() {
  isTouching = true;
  mouseStillness.value = !mouseStillness.value;
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await pageElement.value?.requestFullscreen();
  fullscreen.value = Boolean(document.fullscreenElement);
}

function checkFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement);
}

onMounted(() => document.addEventListener('fullscreenchange', checkFullscreen));
onUnmounted(() => {
  if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
  document.removeEventListener('fullscreenchange', checkFullscreen);
});
</script>

<template>
  <el-drawer
    v-model="open"
    class="room-play-detail"
    direction="btt"
    :with-header="false"
    append-to-body>
    <div
      ref="pageElement"
      class="music-play-detail-layout room-play-detail-layout"
      :class="play.playerMode"
      @mouseleave="checkMouseStillness">
      <div
        class="music-play-detail-header"
        :style="mouseStillness ? 'opacity:0;pointer-events:none' : ''"
        @mouseenter="setMouseMotion">
        <span>
          <el-button
            class="music-button-pure music-icon"
            title="关闭"
            @click="open = false">
            下
          </el-button>
          <el-button
            v-if="!isMobile"
            class="music-button-pure music-icon"
            style="transform: rotateY(180deg)"
            title="全屏"
            @click="toggleFullscreen">
            {{ fullscreen ? '残' : '全' }}
          </el-button>
        </span>
        <span style="line-height: 0"
          >{{ snapshot?.room?.name }} - {{ snapshot?.nickname }}</span
        >
        <div class="music-play-detail-header-right">
          <el-button
            v-if="mode === 'particle'"
            class="music-button-pure room-play-detail-share"
            @click="emit('share')">
            分享
          </el-button>
          <el-dropdown popper-class="music-play-detail-header-mode-dropdown">
            <el-button class="music-play-detail-header-mode music-button-pure">
              <span class="music-icon">下</span>
              歌词模式
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="play.changePlayerMode('default')"
                  >默认模式</el-dropdown-item
                >
                <el-dropdown-item @click="play.changePlayerMode('lyric')"
                  >纯净模式</el-dropdown-item
                >
                <el-dropdown-item @click="play.changePlayerMode('particle')"
                  >粒子模式</el-dropdown-item
                >
                <el-dropdown-item @click="play.changePlayerMode('polar-bear')"
                  >极地小熊</el-dropdown-item
                >
                <el-dropdown-item @click="play.changePlayerMode('colorful')"
                  >多彩心情</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <WindowControls v-if="webView2Services.specialService" />
        </div>
      </div>

      <div
        class="music-play-detail-body"
        :class="[
          mouseStillness ? '' : 'music-play-detail-body-short',
          { 'music-play-detail-body-particle': mode === 'particle' }
        ]"
        @mousemove="onMouseMove"
        @touchstart.stop="onTouchStart">
        <ParticleStage
          v-if="mode === 'particle'"
          :snapshot="snapshot"
          :current="current"
          :lyric="lyric"
          :lyrics-text="lyricsText"
          :position="position"
          :duration="duration"
          :volume="volume"
          :playing="playing"
          :audio="audio"
          :current-avatar="currentAvatar"
          :avatar-resolver="avatarResolver"
          :song-picker-open="songPickerOpen"
          :chat-messages="chatMessages"
          :controls-visible="!mouseStillness"
          embedded
          room-controls
          :console-raised="false"
          @share="emit('share')"
          @toggle-play="emit('togglePlay')"
          @next="emit('next')"
          @toggle-random="emit('toggleRandom')"
          @seek="value => emit('seek', value)"
          @set-volume="value => emit('setVolume', value)"
          @resume="emit('resume')"
          @remove-queue="id => emit('removeQueue', id)"
          @pin-queue="id => emit('pinQueue', id)"
          @add-queue="music => emit('addQueue', music)"
          @pat-member="id => emit('patMember', id)"
          @edit-profile="emit('editProfile')"
          @request-song="emit('requestSong')"
          @send-chat="
            (text, image, avatar) => emit('sendChat', text, image, avatar)
          " />
        <LyricMode v-else-if="mode === 'lyric'" />
        <PolarBearMode
          v-else-if="mode === 'polar-bear'"
          :tools="!mouseStillness" />
        <ColorfulMode
          v-else-if="mode === 'colorful'"
          :tools="!mouseStillness" />
        <DefaultMode v-else />
      </div>

      <div
        v-if="footerVisible"
        class="music-play-detail-footer"
        @mouseenter="setMouseMotion">
        <Footer
          full
          :capabilities="{
            favorite: false,
            sort: snapshot.isAdmin,
            previous: false,
            play:
              snapshot.isAdmin || (snapshot.state.playback.playing && !playing),
            next: snapshot.isAdmin,
            desktopLyric: false,
            queue: false,
            volume: true
          }"
          :style="mouseStillness ? 'opacity:0;pointer-events:none' : ''" />
      </div>
    </div>
  </el-drawer>
</template>

<style scoped lang="less">
.music-play-detail-layout {
  position: relative;
  overflow: hidden;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #05070c;
  --music-slider-color-start: rgba(92, 213, 229, 0);
  --music-slider-color-end: rgba(92, 213, 229, 1);

  &.particle {
    .music-play-detail-header > span > .music-button-pure {
      border-radius: 50%;
    }
  }
}
.music-play-detail {
  &-header {
    z-index: 30;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sat) var(--music-page-padding-horizontal) 0;
    color: white;
    transition: opacity 0.5s;
    .music-button-pure {
      width: 35px;
      height: 35px;
      color: white;
    }
    &-mode {
      width: 100px !important;
      height: 35px !important;
      border-radius: var(--music-infinity);
      .music-icon {
        margin-right: 5px;
        font-size: 12px;
      }
    }
    &-right {
      display: flex;
      align-items: center;
    }
  }
  &-body {
    z-index: 1;
    position: relative;
    width: 100%;
    height: calc(100% - 160px);
    &-particle {
      position: absolute;
      z-index: 1;
      inset: 0;
      height: 100%;
    }
  }
  &-footer {
    z-index: 2;
    :deep(.music-footer-full) {
      transition: opacity 0.5s;
    }
  }
}
.room-play-detail-share {
  width: 64px !important;
  margin-right: 8px;
  border-radius: var(--music-infinity);
}
</style>

<style lang="less">
.room-play-detail.el-drawer {
  width: 100% !important;
  height: 100% !important;
  background: #05070c;
  box-shadow: none;
}
.room-play-detail .el-drawer__body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0;
}
</style>
