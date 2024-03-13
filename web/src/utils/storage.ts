import { webView2Services } from '../utils/utils';
import { httpAddress } from './http';
const useFileAccessor = webView2Services.enabled && webView2Services.isWindows;
let useRemote = false;
export enum StorageKey {
  Language = 'language',
  AppTheme = 'app-theme',
  AutoAppTheme = 'auto-app-theme',
  CustomTheme = 'custom-theme',
  FontFamily = 'font-family',
  CurrentMusic = 'current-music',
  CurrentMusicList = 'current-music-list',
  CurrentMusicHistory = 'current-music-history',
  SortType = 'sort-type',
  PlayerMode = 'player-mode',
  MyLoves = 'my-loves',
  MyFavorites = 'my-favorites',
  MyPlaylists = 'my-playlists',
  Volume = 'volume',
  Progress = 'progress',
  VolumeCache = 'volume-cache',
  Setting = 'setting',
  UserInfo = 'user-info',
  LocalDirectories = 'local-directories',
  PlayQuality = 'play-quality',
  DownloadQuality = 'download-quality',
  LyricOptions = 'lyric-options'
}

function setRemoteMode(remote: boolean) {
  useRemote = remote;
}

async function setValue<T>(key: string, value: T) {
  let result = ``;
  try {
    result = JSON.stringify(value);
  } catch {
    result = `${value}`;
  }
  if (useFileAccessor) {
    await webView2Services.fileAccessor?.WriteConfig('musiche-' + key, result);
  } else if (useRemote) {
    fetch(`//${httpAddress}/storage`, {
      method: 'POST',
      body: JSON.stringify({
        key: 'musiche-' + key,
        value: result
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } else {
    localStorage.setItem('musiche-' + key, result);
  }
}

async function getValue<T>(
  key: string,
  defaultValue?: T,
  type?: string
): Promise<T> {
  var value: any = '';
  if (useFileAccessor) {
    value =
      (await webView2Services.fileAccessor?.ReadConfig('musiche-' + key)) || '';
  } else if (useRemote) {
    try {
      const res = await fetch(
        `//${httpAddress}/storage?key=` + encodeURIComponent('musiche-' + key)
      );
      value = await res.text();
      if (!value) value = null;
    } catch {}
  } else {
    value = localStorage.getItem('musiche-' + key) as any;
  }
  let result: T = value;
  if (value) {
    try {
      result = JSON.parse(value as string);
    } catch {}
  }
  if (defaultValue && (value == undefined || (type && typeof result !== type)))
    result = defaultValue;
  return result;
}

async function removeKey(key: string) {
  if (useFileAccessor) {
    await webView2Services.fileAccessor?.DeleteConfig('musiche-' + key);
  } else {
    localStorage.removeItem('musiche-' + key);
  }
}

export const storage = {
  setValue,
  getValue,
  removeKey,
  setRemoteMode
};
