export type MusicType = 'cloud' | 'qq' | 'migu' | 'local';

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

export interface PlayStatus {
  currentTime: string;
  playing: boolean;
  stopped: boolean;
  totalTime: string;
  progress: number;
  volume: number;
  disableUpdateProgress?: boolean;
  disableUpdateVolume?: boolean;
  volumeCache: number;
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
  remark?: string;
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
  musicList?: Music[];
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

export interface DirectoryInfo {
  name: string;
  path: string;
  selected: boolean;
}

export interface AppTheme {
  id: string;
  name?: string;
  image?: string;
  color?: string;
}

export interface ProxyRequestData {
  url: string;
  method?: string;
  data?: string;
  headers?: Record<string, string>;
  allowAutoRedirect?: boolean;
  setCookieRename?: boolean;
}

export enum CloseType {
  Hide = 'hide',
  Exit = 'exit'
}

export interface WindowInfo {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export type ShortcutType = 'play' | 'last' | 'next' | 'plus' | 'minus' | 'love';

export interface ShortcutKey {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  key: string;
  code?: string;
  type?: string;
  status?: string;
}

export type LoginStatus = 'success' | 'fail' | 'waiting' | 'authorizing';

export type StoreType = 'file-handles-store';

export interface MusicFileInfo {
  path: string;
  file: File;
}

export interface UserInfo {
  id: string;
  name?: string;
  image?: string;
  cookie?: Record<string, string> | string;
}

export interface PlatformAPI {
  search?(
    keywords: string,
    offset: number
  ): Promise<{
    total: number;
    list: Music[];
  }>;
  recommend?(offset: number): Promise<{
    total: number;
    list: Playlist[];
  }>;
  playlistDetail?(
    id: string,
    cookies?: Record<string, string> | string
  ): Promise<{
    total: number;
    list: Music[];
    playlist: Playlist | null;
  }>;
  albumDetail?(id: string): Promise<{
    total: number;
    list: Music[];
    playlist: Playlist | null;
  }>;
  ranking?(ranking: RankingType): Promise<{
    total: number;
    list: Music[];
  }>;
  rankingPlaylist?(ranking: RankingType): Playlist | null;
  musicDetail?(music: Music): Promise<Music | null>;
  qrCodeKey?(): Promise<{
    key: string;
    url: string;
  } | null>;
  loginStatus?(key: string): Promise<{
    status: LoginStatus;
    user?: UserInfo;
  }>;
  userInfo?(cookie: Record<string, string> | string): Promise<UserInfo | null>;
  yours?(
    cookie: Record<string, string> | string,
    offset: number
  ): Promise<{
    total: number;
    list: Playlist[];
  }>;
  musicById?(id: string): Promise<Music | null>;
  parseLink?(link: string): Promise<{
    type: MusicType;
    linkType: 'playlist' | 'music';
    id: string;
  } | null>;
  lyric?(music: Music): Promise<string>;
}
