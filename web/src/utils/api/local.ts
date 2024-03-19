import { IndexDB } from '../db';
import { musicOperate, parseMusicFileImageAddress } from '../http';
import { Music, MusicFileInfo } from '../type';
import { checkReadPermission, getFileName } from '../utils';
import { TagType, jsmediatagsError } from 'jsmediatags/types';
export const fileHandlerDB = new IndexDB('file-handles-store');
let remoteMode = false;

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
    musics.push({
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
    });
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
      image: parseMusicFileImageAddress(music.id || filePath || ''),
      singer: music.singer || '',
      album: music.album || '',
      albumId: '',
      duration: music.duration || '',
      length: music.length || 0,
      vip: false,
      url: music.url || filePath || '',
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
