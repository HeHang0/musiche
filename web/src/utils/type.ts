export type MusicType = 'cloud' | 'qq' | 'migu' | 'local';

export type PlayDetailMode = 'default' | 'lyric' | 'polar-bear';

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
  loading: boolean;
  stopped: boolean;
  totalTime: string;
  progress: number;
  length?: number;
  volume: number;
  disableUpdateProgress?: boolean;
  disableUpdateVolume?: boolean;
  volumeCache: number;
}

export interface Music {
  id: string;
  name: string;
  rawName?: string;
  highlightName?: string;
  image: string;
  mediumImage?: string;
  largeImage?: string;
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
  audition?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  image: string;
  backgroundImage?: string;
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
  duration: string;
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

export type LyricOptionsKey =
  | 'effect'
  | 'topmost'
  | 'fontFamily'
  | 'fontSize'
  | 'fontBold'
  | 'effectColor'
  | 'fontColor';

export type MusicQuality = 'PQ' | 'SQ' | 'HQ' | 'ZQ';

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
    offset: number
  ): Promise<{
    total: number;
    list: Music[];
    playlist: Playlist | null;
  }>;
  albumDetail?(
    id: string,
    offset: number
  ): Promise<{
    total: number;
    list: Music[];
    playlist: Playlist | null;
  }>;
  ranking?(
    ranking: RankingType,
    offset: number
  ): Promise<{
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
  yours?(offset: number): Promise<{
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
  lyricFuzzyMatch?(music: Music): Promise<string>;
  setDownloadQuality?(quality: MusicQuality): void;
  setPlayQuality?(quality: MusicQuality): void;
  downloadUrl?(music: Music): Promise<string>;
}
