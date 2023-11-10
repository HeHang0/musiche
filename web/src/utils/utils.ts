import { MessageParams } from 'element-plus';
import { LyricLine, MusicFileInfo } from './type';

interface SpecialService {
  MouseDownDrag: () => void;
  ResizeWindow: (direction: number) => void;
  ReleaseMouse: () => void;
}

interface FileAccessor {
  ReadFile: (path: string) => Promise<string>;
  WriteFile: (path: string, text: string) => Promise<void>;
  DeleteFile: (path: string) => Promise<void>;
  FileExists: (path: string) => Promise<boolean>;
  ShowSelectedDirectory: () => Promise<string[]>;
  GetMyMusicDirectory: () => Promise<string>;
  ListAllFiles: (
    path: string,
    recursive: boolean,
    onlyAudio: boolean
  ) => Promise<string[]>;
  ListAllAudios: (path: string, recursive: boolean) => Promise<string>;
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

export const isInStandaloneMode = Boolean(
  ('standalone' in window.navigator && window.navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
);
export const isIOS = !!navigator.userAgent.match(
  /\(i[^;]+;( U;)? CPU.+Mac OS X/
);

export function scrollToElementId(
  id: string,
  center?: boolean,
  smooth?: boolean
) {
  const ele = document.getElementById(id);
  if (!ele) return;
  const scrollParams: ScrollIntoViewOptions = {
    behavior: smooth ? 'smooth' : 'instant',
    block: center ? 'center' : 'start'
  };
  ele && ele.scrollIntoView(scrollParams);
}

export function durationTrim(duration: string) {
  if (!duration) return '';
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

export function fixNotchIPhoneHeight() {
  if (!('standalone' in window.navigator && window.navigator.standalone))
    return;
  const computeStyle = getComputedStyle(document.documentElement);
  const sat = computeStyle.getPropertyValue('--sat') || '0';
  const sal = computeStyle.getPropertyValue('--sal') || '0';
  const sar = computeStyle.getPropertyValue('--sar') || '0';
  const sab = computeStyle.getPropertyValue('--sab') || '0';
  if (
    !sat.startsWith('0') ||
    !sal.startsWith('0') ||
    !sar.startsWith('0') ||
    !sab.startsWith('0')
  )
    document.body.parentElement!.style.height = '100vh';
}

export function duration2Millisecond(duration: string) {
  if (!duration || typeof duration != 'string') duration = '';
  duration = duration.replace(/[\[\]\s]/g, '');
  var durations = duration.split('.');
  var date = (durations[0] || '').split(':');
  var len = date.length;
  var millisecond = parseInt((durations[1] || '0').padStart(3, '0'));
  var second = parseInt(date[len - 1] || '0') * 1000;
  var minute = parseInt(date[len - 2] || '0') * 60 * 1000;
  var hour = parseInt(date[len - 3] || '0') * 3600 * 1000;
  return millisecond + hour + minute + second;
}

export function parseLyric(text: string, length: number): LyricLine[] {
  if (!text || typeof text != 'string') return [];
  let lines = text.split('\n');
  let lastProgress = 0;
  const lyricLines = [] as LyricLine[];
  const lyricRegex = /(\[[\d:\.]+\])([\s\S]+)/;
  lines.map(line => {
    const match = lyricRegex.exec(line);
    if (!match) return;
    let progress = Math.min(
      Math.floor((1000 * duration2Millisecond(match[1])) / length),
      1000
    );
    progress = progress || lastProgress;
    lyricLines.push({
      progress: progress,
      text: (match[2] || '').trim(),
      duration: match[1] || '',
      max: 0
    });
    lastProgress = progress;
  });
  for (let i = 0; i < lyricLines.length; i++) {
    if (!lyricLines[i + 1]) {
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

const cookieSkipKeys = ['max-age', 'path', 'httponly', 'expires'];
export function parseCookie(cookie: string): Record<string, string> {
  if (!cookie) cookie = '';
  let cookies = cookie.split(/[;,]/);
  let cookieObj: Record<string, string> = {};
  cookies.map(item => {
    if (item.indexOf('=') === -1) return;
    let kv = item.split('=');
    if (kv.length < 2) return;
    let key = kv[0]?.trim() || '';
    let value = kv[1]?.trim() || '';
    if (key && !cookieSkipKeys.includes(key.toLowerCase()))
      cookieObj[key] = value;
  });
  return cookieObj;
}

export function formatCookies(
  cookies: Record<string, string> | string
): string {
  if (!cookies) return '';
  if (typeof cookies === 'string') return cookies;
  return Object.keys(cookies)
    .map(m => `${m}=${cookies[m]}`)
    .join('; ');
}

export async function checkReadPermission(
  handle: FileSystemHandle
): Promise<'granted' | 'denied' | 'prompt'> {
  const options = { mode: 'read' };
  let permission = await (handle as any).queryPermission(options);
  if (permission === 'granted') return 'granted';
  permission = await (handle as any).requestPermission({
    mode: 'read'
  });
  if (permission === 'granted') return 'granted';
  return 'prompt';
}

export async function readAudioFiles(
  handle: FileSystemDirectoryHandle,
  prefix: string
) {
  const files: MusicFileInfo[] = [];
  try {
    for await (const entry of (handle as any).entries() as [
      string,
      FileSystemDirectoryHandle | FileSystemFileHandle
    ][]) {
      try {
        const filePath = prefix + '/' + entry[0];
        if (entry[1].kind === 'directory') {
          files.splice(
            0,
            0,
            ...(await readAudioFiles(
              entry[1] as FileSystemDirectoryHandle,
              filePath
            ))
          );
        }
        const file = await (entry[1] as FileSystemFileHandle).getFile();
        if (file instanceof File && file.type.includes('audio')) {
          files.push({
            path: filePath,
            file
          });
        }
      } catch {}
    }
  } catch {}
  return files;
}

export function getFileName(filePath: string) {
  if (!filePath || typeof filePath !== 'string') return '';
  const fileNames = filePath.split(/[\\\/]/g);
  return fileNames[fileNames.length - 1].replace(/\.[a-zA-Z\d]+$/, '');
}

export function clearArray(array: any[]) {
  if (Array.isArray(array)) {
    array.splice(0, array.length);
  }
}

export async function imageToDataUrl(
  imageUrl: string,
  maxWidth?: number,
  maxHeight?: number
): Promise<string> {
  var image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = imageUrl;
  await new Promise(resolve => {
    image.onload = resolve;
  });
  let width = image.width;
  let height = image.height;

  if (maxWidth && maxWidth < width) {
    height = (maxWidth * height) / width;
    width = maxWidth;
  }
  if (maxHeight && maxHeight < height) {
    width = (maxHeight * width) / height;
    height = maxHeight;
  }

  image.width = width;
  image.height = height;

  let canvas = document.createElement('canvas');
  canvas.setAttribute('width', `${width}px`);
  canvas.setAttribute('height', `${height}px`);
  var ctx = canvas.getContext('2d');
  if (!ctx) {
    image.remove();
    canvas.remove();
    return '';
  }
  ctx.drawImage(image, 0, 0, image.width, image.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
  image.remove();
  canvas.remove();
  return dataUrl;
}

export function messageOption(message: string, html?: boolean): MessageParams {
  return {
    message: message,
    center: true,
    dangerouslyUseHTMLString: html,
    customClass: 'music-message',
    offset: screen.availHeight * 0.36,
    grouping: true
  };
}

export async function getImageFile(): Promise<File | null> {
  if ((window as any).showOpenFilePicker) {
    const image: FileSystemFileHandle[] = await (
      window as any
    ).showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: true,
      types: [
        {
          description: '图像',
          accept: {
            'image/*': [
              '.png',
              '.gif',
              '.jpeg',
              '.jpg',
              '.bmp',
              '.webp',
              '.tif'
            ]
          }
        }
      ]
    });
    if (!image || image.length === 0) return null;
    return await image[0].getFile();
  } else {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    let timeout: any = null;
    const event: any = await new Promise(resolve => {
      input.onchange = resolve;
      input.click();
      timeout = setTimeout(() => {
        resolve(null); // 用户没有选择文件，手动调用 resolve 表示取消选择
      }, 60000);
    });
    clearTimeout(timeout);
    input.remove();
    return (event.target.files && event.target.files[0]) || '';
  }
}

export function highlightKeys(text: string, keywords: string): string {
  if (!text) return '';
  if (!keywords) return text;
  let highlight = text;
  const keys = keywords.split(/[\s]+/);
  keys.forEach(n => {
    if (n)
      highlight = highlight.replace(
        n,
        `<span class="highlight-text">${n}</span>`
      );
  });
  return highlight;
}
