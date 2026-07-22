<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { usePlayStore } from '../../stores/play';
import { getLocalAudioElement } from '../../utils/http';
import type { RoomQueueItem, RoomSnapshot } from '../../utils/room';
import { SortType } from '../../utils/type';
import ParticleStage from '../particle/ParticleStage.vue';

const props = withDefaults(
  defineProps<{
    controlsVisible?: boolean;
  }>(),
  {
    controlsVisible: true
  }
);

const play = usePlayStore();
const lyric = ref('');
const lyrics = ref<string[]>([]);
const audioElement = ref<HTMLAudioElement | null>(null);

function loadLyrics(lines: string[]) {
  lyrics.value = [...lines];
}

function updateLyricLine(_index: number, text: string) {
  lyric.value = text || '';
}

const current = computed<RoomQueueItem | null>(() => {
  if (!play.music.id) return null;
  return {
    id: `player-${play.music.type}-${play.music.id}`,
    music: play.music,
    requestedBy: 'local-player',
    requestedName: '',
    requestedAt: new Date(0).toISOString()
  };
});

const snapshot = computed<RoomSnapshot>(() => ({
  room: {
    id: 'local-player',
    name: '本地播放器',
    locked: false,
    chatEncrypted: false,
    onlineCount: 1,
    maxMembers: 1,
    currentMusic: play.music,
    createdAt: new Date(0).toISOString()
  },
  state: {
    version: 1,
    current: current.value || undefined,
    queue: [],
    history: [],
    playback: {
      playing: play.playStatus.playing,
      positionMs: Math.round(
        ((play.playStatus.progress || 0) / 1000) * (play.music.length || 0)
      ),
      updatedAt: new Date(0).toISOString()
    },
    randomPlayback: play.sortType === SortType.Random
  },
  isAdmin: false,
  allowGuestQueue: false,
  memberId: 'local-player',
  nickname: '本地播放器',
  credentialSources: []
}));

const duration = computed(() => (play.music.length || 0) / 1000);
const position = computed(
  () => ((play.playStatus.progress || 0) / 1000) * duration.value
);

function togglePlay() {
  if (play.playStatus.playing) void play.pause();
  else void play.play();
}

function seek(seconds: number) {
  if (!duration.value) return;
  void play.changeProgress(
    Math.max(0, Math.min(1000, (seconds / duration.value) * 1000))
  );
}

function toggleRandom() {
  play.setSortType(
    play.sortType === SortType.Random ? SortType.Loop : SortType.Random
  );
}

function refreshAudioElement() {
  audioElement.value = getLocalAudioElement();
}

watch(
  () => `${play.music.type}:${play.music.id}`,
  refreshAudioElement
);

onMounted(() => {
  refreshAudioElement();
  play.subscribeLyric(loadLyrics);
  play.subscribeLyricLine(updateLyricLine);
});

onUnmounted(() => {
  play.subscribeLyric(loadLyrics, true);
  play.subscribeLyricLine(updateLyricLine, true);
});
</script>

<template>
  <div class="music-mode-particle">
    <ParticleStage
      :snapshot="snapshot"
      :current="current"
      :lyric="lyric"
      :lyrics-text="lyrics.join('\n')"
      :position="position"
      :duration="duration"
      :volume="play.playStatus.volume"
      :playing="play.playStatus.playing"
      :audio="audioElement"
      :chat-messages="[]"
      :controls-visible="props.controlsVisible"
      embedded
      :show-cards="false"
      @toggle-play="togglePlay"
      @resume="togglePlay"
      @next="play.next()"
      @toggle-random="toggleRandom"
      @seek="seek"
      @set-volume="play.changeVolume" />
  </div>
</template>

<style lang="less" scoped>
.music-mode-particle {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #05070c;
}
</style>
