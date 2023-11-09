import CloudMusicImage from '../assets/images/cloud-music.webp';
import QQMusicImage from '../assets/images/qq-music.png';
import MiguMusicImage from '../assets/images/migu-music.webp';
import { LogoCircleImage } from '../utils/logo';
import { MusicType } from './type';

const images: Record<string, string> = {
  cloud: CloudMusicImage,
  qq: QQMusicImage,
  migu: MiguMusicImage
};

const names: Record<string, string> = {
  cloud: '网易云音乐',
  qq: 'QQ音乐',
  migu: '咪咕音乐'
};

export const musicTypeInfo: Record<
  string,
  {
    name: string;
    image: string;
    type: MusicType;
  }
> = new Proxy(
  {},
  {
    get: function (_target, prop: MusicType) {
      return {
        name: names[prop] || 'Musiche',
        image: images[prop] || LogoCircleImage,
        type: prop
      };
    }
  }
);

export const musicTypeAll: MusicType[] = ['cloud', 'qq', 'migu'];

export const musicTypeInfoAll = musicTypeAll.map(m => musicTypeInfo[m]);
