import {
  Music,
  MusicType,
  PlatformAPI,
  Playlist,
  RankingType,
  Lyric,
  UserInfo,
  LoginStatus
} from '../type';
import * as cloud from './cloud';
import * as qq from './qq';
import * as migu from './migu';
import * as local from './local';

const musicAPI: Map<MusicType, PlatformAPI> = new Map([
  ['cloud', cloud as PlatformAPI],
  ['qq', qq as PlatformAPI],
  ['migu', migu as PlatformAPI],
  ['local', local as PlatformAPI]
]);

export async function search(
  type: MusicType,
  keywords: string,
  offset: number
): Promise<{
  total: number;
  list: Music[];
}> {
  const func = musicAPI.get(type)?.search;
  try {
    if (func) return await func(keywords, offset);
  } catch (e) {
    console.error(e);
  }
  return {
    total: 0,
    list: []
  };
}

export async function recommend(
  type: MusicType,
  offset: number
): Promise<{
  total: number;
  list: Playlist[];
}> {
  const func = musicAPI.get(type)?.recommend;
  try {
    if (func) return await func(offset);
  } catch (e) {
    console.error(e);
  }
  return {
    total: 0,
    list: []
  };
}

export async function playlistDetail(
  type: MusicType,
  id: string,
  cookies?: Record<string, string> | string
): Promise<{
  total: number;
  list: Music[];
  playlist: Playlist | null;
}> {
  const func = musicAPI.get(type)?.playlistDetail;
  try {
    if (func) return await func(id, cookies);
  } catch (e) {
    console.error(e);
  }
  return {
    total: 0,
    list: [],
    playlist: null
  };
}

export async function albumDetail(
  type: MusicType,
  id: string
): Promise<{
  total: number;
  list: Music[];
  playlist: Playlist | null;
}> {
  const func = musicAPI.get(type)?.albumDetail;
  try {
    if (func) return await func(id);
  } catch (e) {
    console.error(e);
  }
  return {
    total: 0,
    list: [],
    playlist: null
  };
}

export async function ranking(
  type: MusicType,
  ranking: RankingType
): Promise<{
  total: number;
  list: Music[];
}> {
  const func = musicAPI.get(type)?.ranking;
  try {
    if (func) return await func(ranking);
  } catch (e) {
    console.error(e);
  }
  return {
    total: 0,
    list: []
  };
}

export function rankingPlaylist(
  type: MusicType,
  ranking: RankingType
): Playlist | null {
  const func = musicAPI.get(type)?.rankingPlaylist;
  try {
    if (func) return func(ranking);
  } catch (e) {
    console.error(e);
  }
  return null;
}

export async function musicDetail(music: Music): Promise<Music | null> {
  const func = musicAPI.get(music.type)?.musicDetail;
  try {
    if (func) return await func(music);
  } catch (e) {
    console.error(e);
  }
  return null;
}

export async function qrCodeKey(type: MusicType): Promise<{
  key: string;
  url: string;
} | null> {
  const func = musicAPI.get(type)?.qrCodeKey;
  try {
    if (func) return await func();
  } catch (e) {
    console.error(e);
  }
  return null;
}

export async function loginStatus(
  type: MusicType,
  key: string
): Promise<{
  status: LoginStatus;
  user?: UserInfo;
}> {
  const func = musicAPI.get(type)?.loginStatus;
  try {
    if (func) return await func(key);
  } catch (e) {
    console.error(e);
  }
  return { status: 'fail' };
}

export async function userInfo(
  type: MusicType,
  cookie: Record<string, string> | string
): Promise<UserInfo | null> {
  const func = musicAPI.get(type)?.userInfo;
  try {
    if (func) return await func(cookie);
  } catch (e) {
    console.error(e);
  }
  return null;
}

export async function yours(
  type: MusicType,
  cookie: Record<string, string> | string,
  offset: number
): Promise<{
  total: number;
  list: Playlist[];
}> {
  const func = musicAPI.get(type)?.yours;
  try {
    if (func) return await func(cookie, offset);
  } catch (e) {
    console.error(e);
  }
  return {
    total: 0,
    list: []
  };
}

export async function musicById(
  type: MusicType,
  id: string
): Promise<Music | null> {
  const func = musicAPI.get(type)?.musicById;
  try {
    if (func) return await func(id);
  } catch (e) {
    console.error(e);
  }
  return null;
}

export async function parseLink(link: string): Promise<{
  type: MusicType;
  linkType: 'playlist' | 'music';
  id: string;
} | null> {
  try {
    for (let key of musicAPI.keys()) {
      const func = musicAPI.get(key)?.parseLink;
      if (func) {
        const result = await func(link);
        if (result) {
          return {
            ...result,
            type: key
          };
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
  return null;
}

const lyricCache = new Map<string, Lyric>();
export async function lyric(music: Music): Promise<Lyric | null> {
  const cache = lyricCache.get(music.type + music.id);
  if (cache) return cache;
  const func = musicAPI.get(music.type)?.lyric;
  if (func) {
    var text = '';
    for (let i = 0; i < 2; i++) {
      try {
        text = await func(music);
        break;
      } catch (e) {
        console.error(e);
      }
    }
    if (text) {
      const lyric = { text: text };
      lyricCache.set(music.type + music.id, lyric);
      return lyric;
    }
  }
  return null;
}
