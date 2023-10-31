import { webView2Services } from '../utils/utils';
export enum StorageKey {
  Language = 'language',
  AppTheme = 'app-theme',
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
  VolumeCache = 'volume-cache',
  Setting = 'setting',
  UserInfo = 'user-info'
}

async function setValue<T>(key: string, value: T) {
  let result = ``;
  try {
    result = JSON.stringify(value);
  } catch {
    result = `${value}`;
  }
  if (webView2Services.enabled) {
    await webView2Services.fileAccessor?.WriteFile('musiche-' + key, result);
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
  if (webView2Services.enabled) {
    value =
      (await webView2Services.fileAccessor?.ReadFile('musiche-' + key)) || '';
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
  if (webView2Services.enabled) {
    await webView2Services.fileAccessor?.DeleteFile('musiche-' + key);
  } else {
    localStorage.removeItem('musiche-' + key);
  }
}

export const storage = {
  setValue,
  getValue,
  removeKey
};
