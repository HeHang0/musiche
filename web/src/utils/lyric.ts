import { LyricLine, LyricOptionsKey, Music } from './type';
import * as api from './api/api';
import { clearArray, parseLyric, webView2Services } from './utils';
import { musicOperate } from './http';

export type LyricChange = (lines: string[]) => void;
export type LyricLineChange = (
  index: number,
  text: string,
  duration?: number
) => void;

export class LyricManager {
  private static lyricOption = {} as Record<LyricOptionsKey, any>;
  private static lyricDesktopShow = false;
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
  private static canvasContext: CanvasRenderingContext2D | null = null;
  private static canvas: HTMLCanvasElement | null = null;
  private static video: HTMLVideoElement | null = null;

  constructor() {}

  public static setLyricOptions(options: Record<LyricOptionsKey, any>) {
    this.lyricOption = options;
    if (webView2Services.enabled) {
      musicOperate(
        '/lyric',
        JSON.stringify({ ...options, show: LyricManager.lyricDesktopShow })
      );
      return;
    }
  }

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
    const line = this.lyricList[this.index];
    if (!line || !line.text) return;
    this.lyricLineChanges.forEach(m =>
      m.call(
        this,
        this.index,
        line.text,
        webView2Services?.enabled
          ? (this.length * (line.max - line.progress)) / 1000
          : undefined
      )
    );
  }

  private static drawCanvas = (_index: number, text: string) => {
    if (!this.canvas || !this.canvasContext) return;
    this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let fontStyle = [];
    if (this.lyricOption) {
      if (this.lyricOption.fontSize) {
        fontStyle.push(this.lyricOption.fontSize * 1.25 + 'px');
      }
      if (this.lyricOption.fontFamily) {
        fontStyle.push(this.lyricOption.fontFamily);
      }
      if (this.lyricOption.fontBold) {
        fontStyle.push('bold');
      }
    }
    this.canvasContext.font = fontStyle.join(' ');
    this.canvasContext.strokeStyle = this.lyricOption?.effectColor ?? '';
    this.canvasContext.fillStyle = this.lyricOption?.fontColor ?? 'white';
    this.canvasContext.lineWidth = 3;
    this.canvasContext.strokeText(text || '', 300, 60, 600);
    this.canvasContext.fillText(text || '', 300, 60, 600);
  };

  private setWebviewLine(_index: number, text: string, duration?: number) {
    musicOperate('/lyricline?duration=' + (duration || ''), text);
  }

  public showInDesktop(
    title: string,
    show: boolean = true,
    callback: (() => void) | null = null
  ) {
    if (webView2Services.enabled) {
      LyricManager.lyricDesktopShow = show;
      musicOperate(
        '/lyric',
        JSON.stringify({ ...LyricManager.lyricOption, show, title })
      );
      this.subscribeLyricLine(this.setWebviewLine, !show);
      return;
    }
    if (!show) {
      this.subscribeLyricLine(LyricManager.drawCanvas, true);
      if (document.pictureInPictureElement) document.exitPictureInPicture();
      LyricManager.video?.pause();
      if (LyricManager.video) {
        const track = (LyricManager.video?.srcObject as any)?.getVideoTracks();
        track && LyricManager.canvas?.captureStream().removeTrack(track[0]);
        LyricManager.video.srcObject = null;
        LyricManager.video.src = '';
      }
      LyricManager.video?.remove();
      LyricManager.canvas?.remove();
      LyricManager.video = null;
      LyricManager.canvas = null;
      LyricManager.canvasContext = null;
      return;
    }
    LyricManager.canvas = document.createElement('canvas');
    LyricManager.canvas.width = 600;
    LyricManager.canvas.height = 120;
    LyricManager.canvas.style.width = '300px';
    LyricManager.canvas.style.height = '60px';
    LyricManager.canvasContext = LyricManager.canvas.getContext('2d');
    if (!LyricManager.canvasContext) {
      LyricManager.canvas.remove();
      LyricManager.canvas = null;
      return;
    }
    LyricManager.canvasContext.textAlign = 'center';
    LyricManager.canvasContext.textBaseline = 'middle';
    LyricManager.drawCanvas(0, title);
    LyricManager.video = document.createElement('video');
    LyricManager.video.addEventListener('loadedmetadata', () => {
      console.log('loadedmetadata');
      LyricManager.video?.requestPictureInPicture();
    });
    callback &&
      LyricManager.video.addEventListener('leavepictureinpicture', callback);
    LyricManager.video.style.position = 'fixed';
    LyricManager.video.style.left = '0';
    LyricManager.video.style.top = '0';
    LyricManager.video.style.opacity = '0';
    LyricManager.video.style.zIndex = '-123';
    LyricManager.video.muted = true;
    LyricManager.video.autoplay = true;
    LyricManager.video.width = 300;
    LyricManager.video.height = 60;
    LyricManager.video.srcObject = LyricManager.canvas.captureStream();
    document.body.appendChild(LyricManager.video);
    this.subscribeLyricLine(LyricManager.drawCanvas);
  }
}
