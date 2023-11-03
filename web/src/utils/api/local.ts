import { IndexDB } from '../db';
import { Music, MusicFileInfo } from '../type';
import { checkReadPermission, getFileName, webView2Services } from '../utils';
export const fileHandlerDB = new IndexDB('file-handles-store');

export async function fileToMusic(
  fileInfos: MusicFileInfo[]
): Promise<Music[]> {
  const musics: Music[] = [];
  for (let i = 0; i < fileInfos.length; i++) {
    const info = fileInfos[i];
    musics.push({
      id: info.path,
      name: info.file.name.replace(/\.[a-zA-Z\d]+$/, ''),
      image: '',
      singer: '',
      album: '',
      albumId: '',
      duration: '',
      vip: false,
      type: 'local'
    });
  }
  return musics;
}

export function pathToMusic(filePaths: string[]): Music[] {
  const musics: Music[] = [];
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    musics.push({
      id: filePath,
      name: getFileName(filePath),
      image: '',
      singer: '',
      album: '',
      albumId: '',
      duration: '',
      vip: false,
      url: filePath,
      type: 'local'
    });
  }
  return musics;
}

export async function musicDetail(music: Music): Promise<Music> {
  if (webView2Services.enabled) {
    const exists = await webView2Services.fileAccessor?.FileExists(music.id);
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
