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

const loginTips: Record<string, string> = {
  cloud:
    '使用 <a href="https://music.163.com/#/download" target="_blank">网易云音乐APP</a> 扫码登录',
  qq: '使用 <a href="https://im.qq.com" target="_blank">QQ手机版</a> 扫码登录',
  migu: '打开 <a href="https://music.migu.cn/v3/app" target="_blank">咪咕音乐APP</a><br />点击顶部菜单图标,然后找到扫一扫并点击'
};

export const musicTypeInfo: Record<
  string,
  {
    name: string;
    image: string;
    type: MusicType;
    loginTips: string;
  }
> = new Proxy(
  {},
  {
    get: function (_target, prop: MusicType) {
      return <
        {
          name: string;
          image: string;
          type: MusicType;
          loginTips: string;
        }
      >{
        name: names[prop] || 'Musiche',
        image: images[prop] || LogoCircleImage,
        type: prop,
        loginTips: loginTips[prop] || '请点击登录'
      };
    }
  }
);

export const musicTypeAll: MusicType[] = ['cloud', 'qq', 'migu'];

export const musicTypeInfoAll = musicTypeAll.map(m => musicTypeInfo[m]);
