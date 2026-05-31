import { IndexDB } from '../db';
import { musicOperate, parseMusicFileImageAddress } from '../http';
import { Music, MusicFileInfo } from '../type';
import {
  checkReadPermission,
  duration2Millisecond,
  getFileName,
  millisecond2Duration
} from '../utils';
import { StorageKey, storage } from '../storage';
import * as cloud from './cloud';
import { TagType, jsmediatagsError } from 'jsmediatags/types';
export const fileHandlerDB = new IndexDB('file-handles-store');
let remoteMode = false;
const localMusicSupplementCache = new Map<string, Partial<Music> | null>();
let localMusicSupplementCacheLoaded = false;

export function setRemoteMode(remote: boolean) {
  remoteMode = remote;
}

let getJSMediaTags = async () => {
  const jsmediatags = await import('jsmediatags');
  const result = jsmediatags.default;
  getJSMediaTags = () => Promise.resolve(result);
  return result;
};

export async function fileToMusic(
  fileInfos: MusicFileInfo[]
): Promise<Music[]> {
  const musics: Music[] = [];
  for (let i = 0; i < fileInfos.length; i++) {
    const info = fileInfos[i];
    let tag: TagType = {} as any;
    try {
      tag = await new Promise((resolve, reject) => {
        getJSMediaTags()
          .then(jsmediatags => {
            jsmediatags.read(info.file, {
              onSuccess: function (tag: TagType) {
                resolve(tag);
              },
              onError: function (error: jsmediatagsError) {
                reject(error);
              }
            });
          })
          .catch(reject);
      });
    } catch {}
    const rawName = info.file.name.replace(/\.[a-zA-Z\d]+$/, '');
    const music: Music = {
      id: info.path,
      name: tag.tags?.title || rawName,
      rawName: rawName,
      image: tag.tags?.picture?.data
        ? URL.createObjectURL(
            new Blob([new Uint8Array(tag.tags.picture.data as any)], {
              type: tag.tags.picture.format
            })
          )
        : '',
      singer: tag.tags?.artist || '',
      album: tag.tags?.album || '',
      albumId: '',
      duration: '',
      vip: false,
      type: 'local'
    };
    await setMusicDuration(music, info.file);
    if (!music.image) {
      await supplementLocalMusicMetadata(music);
    }
    musics.push(music);
  }
  return musics;
}

export function pathToMusic(filePaths: string[] | Music[]): Music[] {
  const musics: Music[] = [];
  for (let i = 0; i < filePaths.length; i++) {
    let filePath = '';
    let music: Music = {} as any;
    if (typeof filePaths[i] === 'string') {
      filePath = filePaths[i] as string;
    } else {
      music = filePaths[i] as any;
      filePath = music.url || music.id;
    }
    musics.push({
      id: music.id || filePath || '',
      name: music.name || getFileName(filePath),
      rawName: music.rawName || getFileName(filePath),
      image: parseMusicFileImageAddress(music.id || filePath || ''),
      mediumImage: music.mediumImage,
      largeImage: music.largeImage,
      singer: music.singer || '',
      album: music.album || '',
      albumId: '',
      duration: music.duration || '',
      length: music.length || 0,
      vip: false,
      url: music.url || filePath || '',
      lyric: music.lyric,
      lyricUrl: music.lyricUrl,
      type: 'local'
    });
  }
  return musics;
}

export async function musicDetail(music: Music): Promise<Music> {
  if (remoteMode) {
    if (music.url) {
      const exists = await musicOperate(
        '/file/exists?path=' + encodeURIComponent(music.url)
      );
      if (exists) return music;
    }
    const exists = await musicOperate(
      '/file/exists?path=' + encodeURIComponent(music.id)
    );
    music.url = exists ? music.id : undefined;
    return music;
  } else {
    return await musicDetailWeb(music);
  }
}

export async function lyric(music: Music): Promise<string> {
  if (music.lyric) return music.lyric;
  const supplement = await supplementLocalMusicMetadata(music, true);
  return supplement.lyric || '';
}

async function setMusicDuration(music: Music, file: File) {
  if (music.length || music.duration) return;
  const url = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    await new Promise<void>((resolve, reject) => {
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject();
      audio.src = url;
    });
    if (!Number.isNaN(audio.duration) && audio.duration > 0) {
      music.length = Math.round(audio.duration * 1000);
      music.duration = millisecond2Duration(music.length);
    }
  } catch {
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageExists(url?: string) {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.ok || (res.status >= 200 && res.status < 400)) return true;
    res = await fetch(url, {
      headers: {
        Range: 'bytes=0-1'
      }
    });
    return res.ok || (res.status >= 200 && res.status < 400);
  } catch {
    return false;
  }
}

function normalizeName(text?: string) {
  return (text || '')
    .toLowerCase()
    .replace(/\.[a-z\d]+$/i, '')
    .replace(/[（(].*?[）)]/g, ' ')
    .replace(/[^\p{L}\p{N}\-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMatchTokens(music: Music) {
  const searchText = normalizeName(
    [music.rawName, music.name, music.singer].filter(Boolean).join('-')
  );
  return searchText
    .split(/[-\s]+/)
    .map(m => m.trim())
    .filter(m => m.length > 0);
}

function getSearchKeywords(music: Music) {
  const values = [music.singer, music.name, music.rawName]
    .filter(Boolean)
    .map(m => normalizeName(m));
  return Array.from(new Set(values)).join(' ').trim();
}

async function loadLocalMusicSupplementCache() {
  if (localMusicSupplementCacheLoaded) return;
  localMusicSupplementCacheLoaded = true;
  const cache = await storage.getValue<Record<string, Partial<Music> | null>>(
    StorageKey.LocalMusicSupplement,
    {}
  );
  Object.keys(cache || {}).forEach(key => {
    localMusicSupplementCache.set(key, cache[key]);
  });
}

async function saveLocalMusicSupplementCache() {
  const cache: Record<string, Partial<Music> | null> = {};
  Array.from(localMusicSupplementCache.entries())
    .slice(-500)
    .forEach(([key, value]) => {
      cache[key] = value;
    });
  await storage.setValue(StorageKey.LocalMusicSupplement, cache);
}

function scoreRemoteMusic(localMusic: Music, remoteMusic: Music) {
  if (!remoteMusic.image) return -1;
  const tokens = getMatchTokens(localMusic);
  const localText = normalizeName(
    [localMusic.rawName, localMusic.name, localMusic.singer].join(' ')
  );
  const remoteText = normalizeName(
    [remoteMusic.name, remoteMusic.singer, remoteMusic.album].join(' ')
  );
  let tokenScore = 0;
  tokens.forEach(token => {
    if (remoteText.includes(token)) tokenScore += 10;
  });
  if (tokenScore === 0 && !localText.includes(normalizeName(remoteMusic.name))) {
    return -1;
  }
  let score = tokenScore;
  if (localText.includes(normalizeName(remoteMusic.name))) score += 8;
  if (
    localMusic.singer &&
    remoteMusic.singer &&
    normalizeName(remoteMusic.singer).includes(normalizeName(localMusic.singer))
  ) {
    score += 15;
  }
  const localLength =
    localMusic.length || duration2Millisecond(localMusic.duration || '');
  const remoteLength =
    remoteMusic.length || duration2Millisecond(remoteMusic.duration || '');
  if (localLength && remoteLength) {
    const diff = Math.abs(localLength - remoteLength);
    if (diff === 0) score += 60;
    else if (diff <= 3000) score += 50;
    else if (diff <= 10000) score += 20;
    else score -= Math.min(40, Math.floor(diff / 1000));
  }
  return score;
}

export async function supplementLocalMusicMetadata(
  music: Music,
  lyricOnly = false
) {
  if (!music) return music;
  if (!lyricOnly && (await imageExists(music.image))) return music;
  const keywords = getSearchKeywords(music);
  if (!keywords) return music;
  const cacheKey = `${keywords}-${music.duration || music.length || ''}`;
  await loadLocalMusicSupplementCache();
  let supplement = localMusicSupplementCache.get(cacheKey);
  if (supplement === undefined) {
    supplement = null;
    try {
      const res = await cloud.search(keywords, 0, 10);
      let matchedMusic: Music | undefined;
      let matchedScore = -1;
      for (const item of res.list) {
        const score = scoreRemoteMusic(music, item);
        if (score > matchedScore) {
          matchedScore = score;
          matchedMusic = item;
        }
      }
      if (matchedMusic && matchedScore >= 10) {
        supplement = {
          image: matchedMusic.image,
          mediumImage: matchedMusic.mediumImage,
          largeImage: matchedMusic.largeImage
        };
        try {
          const lyricText = await cloud.lyric(matchedMusic);
          if (lyricText && (lyricText.match(/\n/g) || []).length >= 5) {
            supplement.lyric = lyricText;
          }
        } catch {}
      }
    } catch {}
    localMusicSupplementCache.set(cacheKey, supplement);
    await saveLocalMusicSupplementCache();
  }
  if (supplement) {
    if (!lyricOnly && supplement.image) {
      music.image = supplement.image;
      music.mediumImage = supplement.mediumImage;
      music.largeImage = supplement.largeImage;
    }
    if (supplement.lyric) {
      music.lyric = supplement.lyric;
    }
  }
  return music;
}

export async function musicDetailWeb(music: Music): Promise<Music> {
  const filePaths = music.id.split('/');
  if (!filePaths[0]) return music;
  const fileHandlerDb = await fileHandlerDB.getFileHandler(filePaths[0]);
  if (
    !fileHandlerDb ||
    (await checkReadPermission(fileHandlerDb?.handler)) !== 'granted'
  )
    return music;
  var directoryHandle: FileSystemDirectoryHandle | undefined =
    fileHandlerDb.handler;
  for (let i = 1; i < filePaths.length - 1; i++) {
    directoryHandle = await directoryHandle.getDirectoryHandle(filePaths[i]);
  }
  const fileHandler = await directoryHandle?.getFileHandle(
    filePaths[filePaths.length - 1]
  );
  if (fileHandler) {
    music.url = URL.createObjectURL(await fileHandler.getFile());
  }
  return music;
}
