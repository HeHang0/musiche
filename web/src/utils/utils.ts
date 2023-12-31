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
  )?.chrome?.webview?.hostObjects?.sync.specialService;
  webView2Services.fileAccessor = (
    window as any
  )?.chrome?.webview?.hostObjects?.fileAccessor;
  webView2Services.enabled = !!webView2Services.specialService;
} catch (error) {}
let callHandler: ((handlerName: string, ...args: any[]) => any) | undefined =
  void 0;
window.addEventListener('flutterInAppWebViewPlatformReady', () => {
  callHandler = (window as any).flutter_inappwebview.callHandler;
});
try {
  if ('flutter_inappwebview' in window) {
    webView2Services.enabled = true;
    webView2Services.specialService = {
      MouseDownDrag: () => {},
      ResizeWindow: (_direction: number) => {},
      ReleaseMouse: () => {}
    };
    if ((window as any).flutter_inappwebview.callHandler) {
      callHandler = (window as any).flutter_inappwebview.callHandler;
    }
    webView2Services.fileAccessor = {
      ReadFile: (path: string) =>
        callHandler ? callHandler('readFile', path) : Promise.resolve(''),
      WriteFile: (path: string, text: string) =>
        callHandler ? callHandler('writeFile', path, text) : Promise.resolve(),
      DeleteFile: (path: string) =>
        callHandler ? callHandler('deleteFile', path) : Promise.resolve(),
      FileExists: (path: string) =>
        callHandler ? callHandler('fileExists', path) : Promise.resolve(false),
      ShowSelectedDirectory: () =>
        callHandler
          ? callHandler('showSelectedDirectory')
          : Promise.resolve([]),
      GetMyMusicDirectory: () =>
        callHandler ? callHandler('getMyMusicDirectory') : Promise.resolve(''),
      ListAllFiles: (path: string, recursive: boolean, onlyAudio: boolean) =>
        callHandler
          ? callHandler('listAllFiles', path, recursive, onlyAudio)
          : Promise.resolve([]),
      ListAllAudios: (path: string, recursive: boolean) =>
        callHandler
          ? callHandler('listAllAudios', path, recursive)
          : Promise.resolve('')
    };
  } else {
    webView2Services.specialService = (
      window as any
    )?.chrome?.webview?.hostObjects?.sync.specialService;
    webView2Services.fileAccessor = (
      window as any
    )?.chrome?.webview?.hostObjects?.fileAccessor;
    webView2Services.enabled = !!webView2Services.specialService;
  }
} catch (error) {}

export const isInStandaloneMode = Boolean(
  ('standalone' in window.navigator && window.navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
);
export const isIOS = !!(
  navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/) ||
  (/Mac OS X/.test(navigator.userAgent) &&
    navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2)
);
export const isAndroid = /Android/i.test(navigator.userAgent);
export const isWindows = /Windows/i.test(navigator.userAgent);
export const isMobile =
  !isWindows &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
console.log('是', isWindows, isMobile);
export const isSafari =
  !isWindows && !isAndroid && /Safari|AppleWebKit/i.test(navigator.userAgent);

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

// export function scrollToElementId(
//   id: string,
//   center?: boolean,
//   smooth?: boolean
// ) {
//   const ele = document.getElementById(id);
//   if (!ele) return;
//   const scroll = findScrollParent(ele.parentElement);
//   if (!scroll) return;
//   let offsetFix = 0;
//   if (center) {
//     offsetFix += scroll.offsetHeight / 2;
//     offsetFix -= ele.offsetHeight;
//   }
//   scroll.scrollTo({
//     top: ele.offsetTop - offsetFix,
//     behavior: smooth ? 'smooth' : 'instant'
//   });
// }

// function findScrollParent(ele: HTMLElement | null) {
//   if (!ele) return null;
//   if (ele.scrollHeight > ele.offsetHeight) {
//     return ele;
//   }
//   if (ele.parentElement) {
//     return findScrollParent(ele.parentElement);
//   }
//   return null;
// }

function checkFixPwaForIOS() {
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
  ) {
    document.documentElement.style.height = '100vh';
  } else {
    if (fixPwaForIOSCount++ < 30) {
      setTimeout(checkFixPwaForIOS, 100);
    }
  }
  window.removeEventListener('load', checkFixPwaForIOS);
}
let fixPwaForIOSCount = 0;
export function fixPwaForIOS() {
  if (!isIOS || !isInStandaloneMode) return;
  window.addEventListener('load', checkFixPwaForIOS);
  setTimeout(checkFixPwaForIOS, 100);
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
  const timeRegex = /(\[[\d:\.]+\])/g;
  const textList: { millisecond: number; duration: string; text: string }[] =
    [];
  lines.forEach(line => {
    const text = line.replace(timeRegex, '').trim();
    let match;
    let matched = false;
    while ((match = timeRegex.exec(line)) !== null) {
      matched = true;
      textList.push({
        millisecond: duration2Millisecond(match[1]),
        text: text,
        duration: match[1]
      });
    }
    if (!matched && text && !/\[(ti|ar)/.test(text)) {
      textList.push({
        millisecond: 0,
        text: text,
        duration: ''
      });
    }
  });
  textList.sort((a, b) => a.millisecond - b.millisecond);
  textList.forEach(line => {
    let progress = Math.min(
      Math.floor((1000 * line.millisecond) / length),
      1000
    );
    progress = progress || lastProgress;
    lyricLines.push({
      progress: progress,
      text: line.text,
      duration: line.duration,
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

export function getUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
    .toUpperCase();
}

const cookieSkipKeys = new Set([
  'max-age',
  'path',
  'httponly',
  'expires',
  'domain',
  'path',
  'secure',
  'samesite'
]);
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
    if (key && !cookieSkipKeys.has(key.toLowerCase())) {
      if (value || !cookieObj[key]) cookieObj[key] = value;
    }
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

export function dataURLtoBlob(dataUrl: string) {
  var arr = dataUrl.split(',');
  if (arr == null) return null;
  const match = arr[0]?.match(/:(.*?);/);
  if (match == null) return null;
  const mime = match[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
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
    return (event && event.target.files && event.target.files[0]) || '';
  }
}

export function highlightKeys(
  data: string | { name: string; highlightName?: string }[],
  keywords: string
): string | undefined {
  if (!data) return void 0;
  if (!keywords) return void 0;
  var list: { name: string; highlightName?: string }[] = [];
  if (typeof data === 'string') {
    list = [{ name: data, highlightName: '' }];
  } else {
    list = data as { name: string; highlightName?: string }[];
  }
  const keys = keywords.split(/[\s]+/);
  keys.forEach(n => {
    if (!n) return;
    list.forEach(m => {
      m.highlightName = m.name.replace(
        n,
        `<span class="highlight-text">${n}</span>`
      );
    });
  });
  if (typeof data === 'string') {
    return list[0].highlightName;
  }
  return void 0;
}
