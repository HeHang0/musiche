export enum MusicType {
  CloudMusic = 'cloud',
  QQMusic = 'qq',
  MiguMusic = 'migu',
  cloud = 'cloud',
  qq = 'qq',
  migu = 'migu'
}

export enum RankingType {
  Hot = 'hot',
  New = 'new',
  Soar = 'soar',
  hot = 'hot',
  new = 'new',
  soar = 'soar'
}

export enum SortType {
  Loop = 'loop',
  Single = 'single',
  Random = 'random',
  Order = 'order'
}

export interface Music {
  id: string;
  name: string;
  highlightName?: string;
  image: string;
  singer: string;
  album: string;
  albumId: string;
  duration: string;
  length?: number;
  vip: boolean;
  remark: string;
  type: MusicType;
  url?: string;
  lyricUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  image: string;
  type: MusicType;
  description?: string;
}

export interface Album {
  id: string;
  name: string;
  image: string;
  type: MusicType;
  description?: string;
}

export interface Lyric {
  lines?: LyricLine[];
  text: string;
}

export interface LyricLine {
  progress: number;
  max: number;
  text: string;
}

export interface ProxyRequestData {
  url: string;
  method: string;
  data?: string;
  headers?: object;
}

export interface WindowInfo {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export function parseMusicType(type: any) {
  switch (type) {
    case MusicType.MiguMusic:
      return MusicType.MiguMusic;
    case MusicType.QQMusic:
      return MusicType.QQMusic;

    default:
      return MusicType.CloudMusic;
  }
}
