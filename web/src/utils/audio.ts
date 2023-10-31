import { second2Duration } from './utils';

export class AudioPlayer {
  audio: HTMLAudioElement;
  onMessage?: (data: any) => void;
  progressTemp?: number;
  constructor() {
    this.audio = new Audio();
    this.audio.addEventListener('play', this.statusChange.bind(this));
    this.audio.addEventListener('pause', this.statusChange.bind(this));
    this.audio.addEventListener('ended', this.audioEnded.bind(this));
    this.audio.addEventListener('volumechange', this.statusChange.bind(this));
    this.audio.addEventListener('timeupdate', this.statusChange.bind(this));
  }

  async process(type: string, data?: string) {
    switch (type) {
      case 'play':
        return this.play(data);
      case 'pause':
        return this.pause();
      case 'progress':
        return this.progress(parseInt(data || '0'));
      case 'volume':
        return this.volume(parseInt(data || '0'));
      case 'status':
        return this.status();
    }
    return {};
  }

  async play(url?: string) {
    if (url && this.audio.src != url) {
      this.audio.src = url;
    }
    if (!this.audio.src) {
      return this.status();
    }
    try {
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
  status() {
    return {
      data: {
        volume: Math.round(this.audio.volume * 100),
        currentTime: second2Duration(this.audio.currentTime),
        totalTime: second2Duration(this.audio.duration),
        playing: !this.audio.paused,
        stopped: this.audio.ended || !this.audio.src,
        progress:
          this.progressTemp ||
          Math.round(
            (1000 * (this.audio.currentTime || 0)) / (this.audio.duration || 1)
          )
      },
      type: 'status'
    };
  }
  setOnMessage(onMessage: (status: any) => void) {
    this.onMessage = onMessage;
  }
  statusChange() {
    this.onMessage && this.onMessage(this.status());
  }
  audioEnded() {
    this.onMessage &&
      this.onMessage({
        type: 'next',
        data: true
      });
  }
}
