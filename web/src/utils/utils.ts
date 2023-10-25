import { LyricLine } from './type';

interface SpecialService {
  MouseDownDrag: () => void;
  ResizeWindow: (direction: number) => void;
  ReleaseMouse: () => void;
}

interface FileAccessor {
  ReadFile: (path: string) => Promise<string>;
  WriteFile: (path: string, text: string) => Promise<void>;
  DeleteFile: (path: string) => Promise<void>;
}

export const webView2Services = {
  enabled: false,
  specialService: null,
  fileAccessor: null
} as {
  enabled: boolean;
  specialService: SpecialService | null;
  fileAccessor: FileAccessor | null;
};

try {
  webView2Services.specialService = (
    window as any
  )?.chrome.webview?.hostObjects?.sync.specialService;
  webView2Services.fileAccessor = (
    window as any
  )?.chrome.webview?.hostObjects?.fileAccessor;
  webView2Services.enabled = !!webView2Services.specialService;
} catch (error) {}

export function elementScrollClick(id: string, click?: boolean) {
  const menuEle = document.getElementById(id);
  if (!menuEle) return;
  click && menuEle.click();
  const intoView =
    (menuEle as any).scrollIntoViewIfNeeded || menuEle.scrollIntoView;
  intoView.bind(menuEle)();
}

export function durationTrim(duration: string) {
  if (duration.startsWith('00:')) duration = duration.substring(3);
  return duration;
}

export function millisecond2Duration(millisecond: number) {
  return second2Duration(millisecond / 1000);
}

export function second2Duration(second: number) {
  if (typeof second !== 'number') second = 0;
  if (Number.isNaN(second)) return '';
  const hours = Math.floor(second / 3600);
  const minutes = Math.floor((second % 3600) / 60);
  const remainingSeconds = Math.floor(second % 60);

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = remainingSeconds.toString().padStart(2, '0');

  return (
    (hoursStr != '00' ? hoursStr + ':' : '') + `${minutesStr}:${secondsStr}`
  );
}

export function getRandomInt(min: number, max: number, ignore?: number) {
  while (true) {
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    if (ignore == null || result != ignore) {
      return result;
    }
  }
}

export function duration2Millisecond(duration: string) {
  if (!duration || typeof duration != 'string') duration = '';
  duration = duration.substring(1, duration.length - 1);
  var durations = duration.split('.');
  var date = (durations[0] || '').split(':');
  var len = date.length;
  var millisecond = parseInt(durations[1] || '0');
  var second = parseInt(date[len - 1] || '0');
  var minute = parseInt(date[len - 2] || '0');
  var hour = parseInt(date[len - 3] || '0');
  return millisecond + 1000 * (hour * 360 + minute * 60 + second);
}

export function parseLyric(text: string, length: number) {
  if (!text || typeof text != 'string') text = '';
  var lines = text.split('\n');
  var lastProgress = 0;
  const lyricLines = [] as LyricLine[];
  const lyricRegex = /(\[[\d:\.]+\])([\s\S]+)/;
  lines.map(line => {
    var match = lyricRegex.exec(line);
    if (!match) return;
    var progress = Math.round(
      1000 * (duration2Millisecond(match[1]) / length || lastProgress)
    );
    lyricLines.push({
      progress: progress,
      text: match[2] || '',
      max: 0
    });
    lastProgress = progress;
  });
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i + 1] == null) {
      lyricLines[i].max = 1000;
    } else {
      lyricLines[i].max = lyricLines[i + 1].progress;
    }
  }
  return lyricLines;
}

export function generateGuid() {
  return (
    new Date().getTime().toString() +
    Math.abs(
      (Math.round(2147483647 * Math.random()) * new Date().valueOf()) % 1e10
    ).toString()
  );
}
