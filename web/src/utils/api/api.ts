import { Music, MusicType, Playlist, RankingType, Lyric } from '../type';
import * as cloud from './cloud';
import * as qq from './qq';
import * as migu from './migu';

const musicAPI: Map<MusicType, any> = new Map([
  [MusicType.CloudMusic, cloud as any],
  [MusicType.QQMusic, qq as any],
  [MusicType.MiguMusic, migu as any]
]);

function getFunction(type: MusicType, funcName: string) {
  if (musicAPI.has(type)) {
    return musicAPI.get(type)[funcName];
  }
  return null;
}

export async function search(
  type: MusicType,
  keywords: string,
  offset: number
): Promise<{
  total: number;
  list: Music[];
}> {
  var func = getFunction(type, 'search');
  if (func) return func(keywords, offset);
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
  list: Music[];
}> {
  var func = getFunction(type, 'recommend');
  if (func) return func(offset);
  return {
    total: 0,
    list: []
  };
}

export async function playlistDetail(
  type: MusicType,
  id: string
): Promise<{
  total: number;
  list: Music[];
  playlist: Playlist | null;
}> {
  var func = getFunction(type, 'playlistDetail');
  if (func) return func(id);
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
  var func = getFunction(type, 'albumDetail');
  if (func) return func(id);
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
  var func = getFunction(type, 'ranking');
  if (func) return func(ranking);
  return {
    total: 0,
    list: []
  };
}

export async function musicDetail(music: Music): Promise<Music | null> {
  var func = getFunction(music.type, 'musicDetail');
  if (func) return func(music);
  return null;
}

const lyricCache = new Map<string, Lyric>();
export async function lyric(music: Music): Promise<Lyric | null> {
  const cache = lyricCache.get(music.type + music.id);
  if (cache) return cache;
  var func = getFunction(music.type, 'lyric');
  if (func) {
    var text = await func(music);
    if (text) {
      const lyric = { text: text };
      lyricCache.set(music.type + music.id, lyric);
      return lyric;
    }
  }
  return null;
}
