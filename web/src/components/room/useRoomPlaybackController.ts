import { reactive, watch } from 'vue';
import { usePlayStore } from '../../stores/play';
import { LogoImage } from '../../utils/logo';
import type { RoomSnapshot } from '../../utils/room';
import { SortType, type Music } from '../../utils/type';
import { millisecond2Duration } from '../../utils/utils';

type RoomCurrent = RoomSnapshot['state']['current'];
type LyricChange = (lines: string[]) => void;
type LyricLineChange = (index: number, text: string) => void;

export interface RoomPlaybackControllerOptions {
  current: () => RoomCurrent | null;
  position: () => number;
  duration: () => number;
  volume: () => number;
  playing: () => boolean;
  loading: () => boolean;
  random: () => boolean;
  active: () => boolean;
  isAdmin: () => boolean;
  lyricsText: () => string;
  lyric: () => string;
  togglePlay: () => void;
  resume: () => void;
  next: () => void;
  toggleRandom: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
}

const emptyMusic: Music = {
  id: '',
  name: '',
  image: LogoImage,
  singer: '',
  album: '',
  albumId: '',
  duration: '',
  vip: false,
  type: 'cloud'
};

export function useRoomPlaybackController(
  options: RoomPlaybackControllerOptions
) {
  const play = usePlayStore();
  const lyricCallbacks = new Set<LyricChange>();
  const lyricLineCallbacks = new Set<LyricLineChange>();
  let volumeCache = options.volume() || 80;

  const playStatus = reactive({
    currentTime: '00:00',
    totalTime: '',
    playing: false,
    loading: false,
    stopped: false,
    progress: 0,
    volume: options.volume(),
    volumeCache,
    disableUpdateProgress: false,
    disableUpdateVolume: false
  });

  const lyricLines = () =>
    options
      .lyricsText()
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

  function publishLyrics() {
    const lines = lyricLines();
    lyricCallbacks.forEach(callback => callback(lines));
    publishLyricLine(lines);
  }

  function publishLyricLine(lines = lyricLines()) {
    const text = options.lyric();
    const index = Math.max(0, lines.indexOf(text));
    lyricLineCallbacks.forEach(callback => callback(index, text));
  }

  watch(
    () => [options.position(), options.duration(), options.playing(), options.loading()],
    ([position, duration, playing, loading]) => {
      playStatus.currentTime = millisecond2Duration(Number(position));
      playStatus.totalTime = millisecond2Duration(Number(duration));
      playStatus.playing = Boolean(playing);
      playStatus.loading = Boolean(loading);
      playStatus.stopped = !playing;
      if (!playStatus.disableUpdateProgress) {
        playStatus.progress = duration
          ? Math.min(1000, Math.max(0, (Number(position) / Number(duration)) * 1000))
          : 0;
      }
    },
    { immediate: true }
  );

  watch(
    () => options.volume(),
    volume => {
      if (volume > 0) volumeCache = volume;
      playStatus.volumeCache = volumeCache;
      if (!playStatus.disableUpdateVolume) playStatus.volume = volume;
    },
    { immediate: true }
  );
  watch(() => options.lyricsText(), publishLyrics, { immediate: true });
  watch(() => options.lyric(), () => publishLyricLine());

  return reactive({
    get music() {
      return options.current()?.music || emptyMusic;
    },
    get myLover() {
      return play.myLover;
    },
    get sortType() {
      return options.random() ? SortType.Random : SortType.Order;
    },
    get playDetailShow() {
      return options.active();
    },
    get currentListShow() {
      return false;
    },
    set currentListShow(_value: boolean) {},
    get desktopLyricShow() {
      return false;
    },
    config: { remote: false },
    currentListPopover: { show: false },
    playStatus,
    addMyLove(musics: Music[], remove = false) {
      return play.addMyLove(musics, remove);
    },
    setSortType(type: SortType) {
      const random = options.random();
      if ((type === SortType.Random) !== random && options.isAdmin()) {
        options.toggleRandom();
      }
    },
    last() {},
    pause() {
      if (options.isAdmin()) options.togglePlay();
    },
    play() {
      if (options.isAdmin()) options.togglePlay();
      else options.resume();
    },
    next() {
      if (options.isAdmin()) options.next();
    },
    showDesktopLyric() {},
    mute() {
      options.setVolume(playStatus.volume > 0 ? 0 : volumeCache || 80);
    },
    changeProgress(value: number) {
      playStatus.disableUpdateProgress = false;
      const duration = options.duration();
      if (duration) options.seek((Number(value) / 1000) * duration);
    },
    changeVolume(value: number) {
      playStatus.disableUpdateVolume = false;
      options.setVolume(Number(value));
    },
    subscribeLyric(callback: LyricChange, cancel = false) {
      if (cancel) lyricCallbacks.delete(callback);
      else {
        lyricCallbacks.add(callback);
        callback(lyricLines());
      }
    },
    subscribeLyricLine(callback: LyricLineChange, cancel = false) {
      if (cancel) lyricLineCallbacks.delete(callback);
      else {
        lyricLineCallbacks.add(callback);
        const lines = lyricLines();
        const text = options.lyric();
        callback(Math.max(0, lines.indexOf(text)), text);
      }
    }
  });
}
