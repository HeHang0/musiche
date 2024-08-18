import { second2Duration } from './utils';

export class AudioPlayer {
  audio: HTMLAudioElement;
  onMessage?: (data: any) => void;
  progressTemp?: number;
  fadeIn: boolean = false;
  fadeInVolume?: number;
  lastProgress?: number;
  useHuaweiCloud: boolean = false;
  proxyAddress: string;
  constructor(useHuaweiCloud: boolean, proxyAddress: string) {
    this.useHuaweiCloud = useHuaweiCloud;
    this.proxyAddress = proxyAddress;
    this.audio = new Audio();
    this.audio.addEventListener('play', this.audioPlay.bind(this));
    this.audio.addEventListener(
      'pause',
      this.statusChange.bind(this, undefined)
    );
    this.audio.addEventListener('ended', this.audioEnded.bind(this));
    this.audio.addEventListener(
      'volumechange',
      this.statusChange.bind(this, undefined)
    );
    this.audio.addEventListener('timeupdate', this.timeUpdate.bind(this));
  }
  initMediaAction() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler(
      'play',
      this.sendMessage.bind(this, 'playOrPause')
    );
    navigator.mediaSession.setActionHandler(
      'pause',
      this.sendMessage.bind(this, 'playOrPause')
    );
    navigator.mediaSession.setActionHandler(
      'stop',
      this.sendMessage.bind(this, 'pause')
    );
    navigator.mediaSession.setActionHandler(
      'previoustrack',
      this.sendMessage.bind(this, 'last', true)
    );
    navigator.mediaSession.setActionHandler(
      'nexttrack',
      this.sendMessage.bind(this, 'next', true)
    );
  }
  setFadeIn(fadeIn: boolean) {
    this.fadeIn = fadeIn;
  }

  mediaMeta(meta: MediaMetadataInit) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      ...meta,
      title: meta.title || document.title
    });
  }

  async process(type: string, data?: string) {
    switch (type) {
      case 'play':
        return this.play(data);
      case 'fadein':
        return this.setFadeIn(Boolean(data));
      case 'pause':
        return this.pause();
      case 'progress':
        return this.progress(parseInt(data || '0'));
      case 'volume':
        return this.volume(parseInt(data || '0'));
      case 'status':
        return this.status();
      case 'media':
        return this.mediaMeta(JSON.parse(data || '{}'));
    }
    return {};
  }

  async play(url?: string) {
    if (url && this.audio.src != url) {
      if (this.useHuaweiCloud) {
        const audioUrl = this.proxyAddress + '?url=' + encodeURIComponent(url);
        this.audio.src = audioUrl;
      } else {
        this.audio.src = url;
      }
    }
    if (!this.audio.src) {
      return this.status();
    }
    try {
      if (this.fadeIn) {
        this.fadeInVolume = this.audio.volume;
        this.audio.volume = 0;
      } else {
        this.fadeInVolume = undefined;
      }
      await this.audio.play();
    } catch {}

    if (this.progressTemp && !isNaN(this.audio.duration)) {
      this.audio.currentTime = Math.round(
        (this.audio.duration * this.progressTemp) / 1000
      );
      this.progressTemp = 0;
    }
    return this.status();
  }
  pause() {
    this.audio.pause();
    return this.status();
  }
  progress(progress: number) {
    if (isNaN(this.audio.duration)) {
      this.progressTemp = progress;
      return this.status();
    }
    this.audio.currentTime = isNaN(this.audio.duration)
      ? 0
      : Math.round((this.audio.duration * progress) / 1000);
    return this.status();
  }
  volume(volume: number) {
    this.audio.volume = volume / 100;
    return this.status();
  }
  status(progress?: number) {
    if (typeof progress !== 'number') progress = undefined;
    this.lastProgress =
      this.progressTemp ||
      progress ||
      Math.round(
        (1000 * (this.audio.currentTime || 0)) / (this.audio.duration || 1)
      );
    return {
      data: {
        volume: Math.round((this.fadeInVolume || this.audio.volume) * 100),
        currentTime: second2Duration(this.audio.currentTime),
        totalTime: second2Duration(this.audio.duration),
        playing: !this.audio.paused,
        stopped: this.audio.ended || !this.audio.src,
        progress: this.lastProgress
      },
      type: 'status'
    };
  }
  setOnMessage(onMessage: (status: any) => void) {
    this.onMessage = onMessage;
  }
  statusChange(progress?: number) {
    this.onMessage && this.onMessage(this.status(progress));
  }
  timeUpdate() {
    if (
      this.fadeInVolume &&
      this.fadeInVolume > this.audio.volume &&
      this.fadeInVolume <= 1
    ) {
      this.audio.volume = Math.min(this.audio.volume + 0.1, this.fadeInVolume);
    } else if (this.fadeInVolume != null) {
      this.fadeInVolume = undefined;
    }
    const progress = Math.round(
      (1000 * (this.audio.currentTime || 0)) / (this.audio.duration || 1)
    );
    if (this.lastProgress !== progress) this.statusChange(progress);
  }
  sendMessage(type: string, body?: any) {
    this.onMessage &&
      this.onMessage({
        type: type,
        data: body ?? true
      });
  }
  audioEnded() {
    if (this.audio.src?.startsWith('blob')) {
      URL.revokeObjectURL(this.audio.src);
    }
    this.sendMessage('next', true);
  }
  audioPlay() {
    this.initMediaAction();
    this.statusChange();
  }
}
