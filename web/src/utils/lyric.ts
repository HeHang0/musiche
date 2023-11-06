import { LyricLine, Music } from './type';
import * as api from './api/api';
import { clearArray, parseLyric } from './utils';

export type LyricChange = (lines: string[]) => void;
export type LyricLineChange = (index: number, text: string) => void;

export class LyricManager {
  private index: number = -1;
  private title: string = '';
  private progress: number = 0;
  private id: string = '';
  private length: number = 0;
  private parsed: boolean = false;
  private music: Music | null = null;
  private lyricList: LyricLine[] = [];
  private lyricChanges: LyricChange[] = [];
  private lyricLineChanges: LyricLineChange[] = [];
  private canvasContext: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;

  constructor() {}

  public updateLyricLine(progress: number) {
    if (this.lyricList.length == 0) return;
    if (this.lyricLineChanges.length == 0) {
      this.progress = progress;
      return;
    }
    if (
      this.lyricList[this.index]?.progress < progress &&
      this.lyricList[this.index]?.max > progress
    ) {
      return;
    }
    let i = this.progress > progress ? 0 : this.index < 0 ? 0 : this.index;
    this.progress = progress;
    const lineLength = this.lyricList.length;
    let publisher = false;
    for (; i < lineLength; i++) {
      const line = this.lyricList[i];
      if (line.progress <= this.progress && line.max > this.progress) {
        for (let j = i + 1; j < lineLength; j++) {
          if (this.lyricList[j].progress === line.progress) continue;
          else {
            i = j - 1;
            break;
          }
        }

        if (this.index != i) {
          this.index = i;
          publisher = true;
        }
        break;
      }
    }
    publisher && this.publishLyricLine();
  }

  public updateLyric(music: Music) {
    const remoteId = `${music.type}${music.id}`;
    if (this.parsed && this.id == remoteId && this.length == music.length) {
      return;
    }
    this.id = remoteId;
    this.index = -1;
    this.progress = 0;
    this.length = music.length || 0;
    this.parsed = false;
    this.music = music;
    this.title = music.name;
    if (music.singer) {
      this.title += ' - ' + music.singer;
    }
    this.lyricLineChanges.forEach(m => m.call(this, this.index, this.title));
    clearArray(this.lyricList);
    if (!music.length) {
      this.publishLyric();
      return;
    }
    if (this.lyricChanges.length > 0 || this.lyricLineChanges.length > 0) {
      this.parseLyric();
    }
  }

  public subscribeLyric(
    callback: LyricChange,
    cancel?: boolean,
    music?: Music
  ) {
    if (!callback) return;
    const index = this.lyricChanges.indexOf(callback);
    if (!cancel && index < 0) {
      this.lyricChanges.push(callback);
    } else if (cancel && index >= 0) {
      this.lyricChanges.splice(index, 1);
    }
    if (!this.parsed) {
      if (music) this.updateLyric(music);
      else this.parseLyric();
    } else callback(this.lyricList.map(m => m.text));
  }

  public subscribeLyricLine(
    callback: LyricLineChange,
    cancel?: boolean,
    music?: Music
  ) {
    if (!callback) return;
    const index = this.lyricLineChanges.indexOf(callback);
    if (!cancel && index < 0) {
      this.lyricLineChanges.push(callback);
    } else if (cancel && index >= 0) {
      this.lyricLineChanges.splice(index, 1);
    }
    if (!this.parsed) {
      if (music) this.updateLyric(music);
      else this.parseLyric();
    } else callback(this.index, this.lyricList[this.index]?.text || this.title);
  }

  private async parseLyric() {
    if (!this.music || this.parsed) return;
    const lyric = await api.lyric(this.music);
    if (!lyric) {
      this.publishLyric();
      return;
    }
    clearArray(this.lyricList);
    parseLyric(lyric, this.length).forEach(m => this.lyricList.push(m));
    if (
      this.lyricList.length < 5 &&
      this.lyricList[this.lyricList.length - 1].progress >= 1000
    ) {
      for (let i = 0; i < this.lyricList.length; i++) {
        if (i == this.lyricList.length - 1) {
          this.lyricList[i].max = 1000;
        } else {
          this.lyricList[i].max = 0;
        }
        this.lyricList[i].progress = 0;
      }
    }
    this.parsed = true;
    this.publishLyric();
  }

  private publishLyric() {
    const lines = this.lyricList.map(m => m.text);
    this.lyricChanges.forEach(m => m.call(this, lines));
    this.lyricLineChanges.forEach(m =>
      m.call(this, 0, lines[this.index] || this.title)
    );
  }

  private publishLyricLine() {
    const text = this.lyricList[this.index]?.text;
    if (!text) return;
    this.lyricLineChanges.forEach(m => m.call(this, this.index, text));
  }

  private drawCanvas = (_index: number, text: string) => {
    if (!this.canvas || !this.canvasContext) return;
    this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasContext.fillText(text || this.title || '', 300, 60, 600);
  };

  public showInDesktop(
    title: string,
    show: boolean = true,
    callback: (() => void) | null = null
  ) {
    if (!show) {
      this.subscribeLyricLine(this.drawCanvas, true);
      document.exitPictureInPicture();
      this.video?.pause();
      if (this.video) {
        const track = (this.video?.srcObject as any)?.getVideoTracks();
        track && this.canvas?.captureStream().removeTrack(track[0]);
        this.video.srcObject = null;
        this.video.src = '';
      }
      this.video?.remove();
      this.canvas?.remove();
      this.video = null;
      this.canvas = null;
      this.canvasContext = null;
      return;
    }
    this.canvas = document.createElement('canvas');
    this.canvas.width = 600;
    this.canvas.height = 120;
    this.canvas.style.width = '300px';
    this.canvas.style.height = '60px';
    this.canvasContext = this.canvas.getContext('2d');
    if (!this.canvasContext) {
      this.canvas.remove();
      this.canvas = null;
      return;
    }
    this.canvasContext.font = '60px Microsoft YaHei';
    this.canvasContext.textAlign = 'center';
    this.canvasContext.fillStyle = '#fff';
    this.canvasContext.textBaseline = 'middle';
    this.canvasContext.fillText(title, 300, 60, 600);

    this.video = document.createElement('video');
    this.video.addEventListener('loadedmetadata', () => {
      console.log('loadedmetadata');
      this.video?.requestPictureInPicture();
    });
    callback && this.video.addEventListener('leavepictureinpicture', callback);
    this.video.style.position = 'fixed';
    this.video.style.left = '0';
    this.video.style.top = '0';
    this.video.style.opacity = '0';
    this.video.style.zIndex = '-1';
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.width = 300;
    this.video.height = 60;
    this.video.srcObject = this.canvas.captureStream();
    document.body.appendChild(this.video);
    this.subscribeLyricLine(this.drawCanvas);
  }
}
