import { httpAddress } from './http';
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
  LyricOptions = 'lyric-options',
  ProxyAddress = 'proxy-address'
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
  if (useRemote) {
    fetch(
      `//${httpAddress}/storage?key=` + encodeURIComponent('musiche-' + key),
      {
        method: 'POST',
        body: result,
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    );
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
  if (useRemote) {
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
  if (useRemote) {
    try {
      await fetch(
        `//${httpAddress}/storage?key=` + encodeURIComponent('musiche-' + key),
        {
          method: 'DELETE'
        }
      );
    } catch {}
  } else {
    localStorage.removeItem('musiche-' + key);
  }
}

async function getAll() {
  const result: Record<string, any> = {};
  if (useRemote) {
    try {
      const res = await fetch(`//${httpAddress}/storages`);
      const data = await res.json();
      for (const key in data) {
        if (!key || !key.startsWith('musiche-')) continue;
        let value = data[key];
        try {
          result[key.substring(8)] = JSON.parse(value as string);
        } catch {
          result[key.substring(8)] = value;
        }
      }
    } catch {}
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      let key = localStorage.key(i)?.trim();
      if (!key || !key.startsWith('musiche-')) continue;
      let value = localStorage.getItem(key);
      try {
        result[key.substring(8)] = JSON.parse(value as string);
      } catch {
        result[key.substring(8)] = value;
      }
    }
  }
  return result;
}

export const storage = {
  setValue,
  getValue,
  getAll,
  removeKey,
  setRemoteMode
};
