import { LyricLine, LyricOptionsKey, Music } from './type';
import * as api from './api/api';
import { clearArray, messageOption, parseLyric, isWindows } from './utils';
import { musicOperate } from './http';
import { ElMessage, ElMessageBox } from 'element-plus';
import { isIOS } from '@vueuse/core';

export type LyricChange = (lines: string[]) => void;
export type LyricLineChange = (
  index: number,
  text: string,
  duration?: number
) => void;

const devicePixelRatio = (window.devicePixelRatio || 1) * 2;
let defaultFont = '';
export class LyricManager {
  private static lyricOption = {} as Record<LyricOptionsKey, any>;
  private static lyricDesktopShow = false;
  private static lyricText = '';
  private index: number = -1;
  private title: string = '';
  private progress: number = 0;
  private id: string = '';
  private length: number = 0;
  private parsed: boolean = false;
  private parsing: boolean = false;
  private music: Music | null = null;
  private lyricList: LyricLine[] = [];
  private lyricChanges: LyricChange[] = [];
  private lyricLineChanges: LyricLineChange[] = [];
  private static canvasContext: CanvasRenderingContext2D | null = null;
  private static canvas: HTMLCanvasElement | null = null;
  private static video: HTMLVideoElement | null = null;
  private static remoteMode: boolean = false;

  constructor() {}

  public static setRemoteMode(remote: boolean) {
    this.remoteMode = remote;
  }

  public static setLyricOptions(options: Record<LyricOptionsKey, any>) {
    this.lyricOption = options;
    if (this.remoteMode) {
      musicOperate(
        '/lyric',
        JSON.stringify({ ...options, show: LyricManager.lyricDesktopShow })
      );
      return;
    } else {
      this.lyricText && this.drawCanvas(0, this.lyricText);
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
    if (
      (this.parsed || this.parsing) &&
      this.id == remoteId &&
      this.length == music.length
    ) {
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
    this.parsing = true;
    const lyric = await api.lyric(this.music);
    this.parsing = false;
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
        LyricManager.remoteMode
          ? (this.length * (line.max - line.progress)) / 1000
          : undefined
      )
    );
  }

  private static drawCanvas = (_index: number, text: string) => {
    if (!this.canvas || !this.canvasContext) return;
    this.lyricText = text;
    let fontStyle = [];
    if (this.lyricOption) {
      if (this.lyricOption.fontBold) {
        fontStyle.push('bold');
      }
      if (this.lyricOption.fontSize) {
        fontStyle.push(
          `${Math.floor(this.lyricOption.fontSize * devicePixelRatio)}px`
        );
      }
      if (this.lyricOption.fontFamily) {
        let fontFamily = this.lyricOption.fontFamily;
        if (fontFamily.includes(' ')) fontFamily = `'${fontFamily}'`;
        fontStyle.push(fontFamily);
      } else {
        if (!defaultFont) {
          defaultFont =
            window
              .getComputedStyle(document.body)
              .fontFamily.split(',')
              .at(0)
              ?.trim() || 'arial';
        }
        fontStyle.push(defaultFont);
      }
    }
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    this.canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    this.canvasContext.font = fontStyle.join(' ');
    this.canvasContext.fillStyle = this.lyricOption?.fontColor ?? 'white';
    const x = Math.floor(canvasWidth / 2);
    const y = Math.floor(canvasHeight / 2);
    if (this.lyricOption?.effect) {
      this.canvasContext.strokeStyle = this.lyricOption?.effectColor || '';
      this.canvasContext.strokeText(text || '', x, y, canvasWidth);
    }
    this.canvasContext.fillText(text || '', x, y, canvasWidth);
  };

  private setWebviewLine(_index: number, text: string, duration?: number) {
    musicOperate(
      '/lyricline?duration=' + ((isWindows && duration) || ''),
      text
    );
  }

  public showInDesktop(
    title: string,
    show: boolean = true,
    callback: (() => void) | null = null,
    music?: Music
  ) {
    if (LyricManager.remoteMode) {
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
    (LyricManager.canvas as any).style['-webkit-font-smoothing'] =
      'antialiased';
    (LyricManager.canvas as any).style['-moz-osx-font-smoothing'] = 'grayscale';
    const width = 300;
    const height = 40;
    LyricManager.canvas.width = width * devicePixelRatio;
    LyricManager.canvas.height = height * devicePixelRatio;
    LyricManager.canvas.style.width = width + 'px';
    LyricManager.canvas.style.height = height + 'px';
    LyricManager.canvasContext = LyricManager.canvas.getContext('2d');
    if (!LyricManager.canvasContext) {
      LyricManager.canvas.remove();
      LyricManager.canvas = null;
      return;
    }
    LyricManager.canvasContext.imageSmoothingEnabled = true;
    LyricManager.canvasContext.lineWidth = Math.floor(1.5 * devicePixelRatio);
    LyricManager.canvasContext.textAlign = 'center';
    LyricManager.canvasContext.textBaseline = 'middle';
    LyricManager.drawCanvas(0, title);
    LyricManager.video = document.createElement('video');
    LyricManager.video.addEventListener('loadedmetadata', () => {
      if (!LyricManager.video?.requestPictureInPicture) {
        ElMessage(messageOption('暂不支持桌面歌词'));
        callback && callback();
        return;
      }
      try {
        LyricManager.video?.play();
      } catch {}
      if ('flutter_inappwebview' in window && isIOS) {
        LyricManager.video?.requestPictureInPicture();
        return;
      }
      LyricManager.video?.requestPictureInPicture().catch(_e => {
        ElMessageBox.confirm('', '开启桌面歌词', {
          closeOnClickModal: false,
          showCancelButton: false,
          showClose: false,
          confirmButtonText: '确定'
        })
          .then(() => {
            LyricManager.video
              ?.requestPictureInPicture()
              .then(() => {
                try {
                  LyricManager.video?.play();
                } catch {}
              })
              .catch(() => {
                ElMessage(messageOption('开启桌面歌词失败'));
                callback && callback();
              });
          })
          .catch(callback);
      });
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
    LyricManager.video.controls = false;
    LyricManager.video.playsInline = false;
    LyricManager.video.width = width;
    LyricManager.video.height = height;
    LyricManager.video.srcObject = LyricManager.canvas.captureStream(25);
    document.body.appendChild(LyricManager.video);
    this.subscribeLyricLine(LyricManager.drawCanvas, false, music);
  }
}
