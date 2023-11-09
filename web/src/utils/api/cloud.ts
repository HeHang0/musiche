import * as CryptoJS from 'crypto-js';
import {
  Music,
  MusicType,
  Playlist,
  RankingType,
  UserInfo,
  LoginStatus,
  MusicQuality
} from '../type';
import { httpProxy } from '../http';
import {
  duration2Millisecond,
  highlightKeys,
  millisecond2Duration,
  parseCookie
} from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-soar.jpg';
const QRCode = () => import('qrcode');

const musicType: MusicType = 'cloud';

var cloudCookie: Record<string, string> = {};

var qrcodeGenerate: (text: string) => Promise<string> = async (
  text: string
) => {
  const qrcode = await QRCode();
  qrcodeGenerate = qrcode.toDataURL as any;
  return qrcodeGenerate(text);
};

function aesEncrypt(plain: string, key: string): string {
  var iv = '0102030405060708';
  var cipherText = CryptoJS.AES.encrypt(plain, CryptoJS.enc.Utf8.parse(key), {
    iv: CryptoJS.enc.Utf8.parse(iv),
    mode: CryptoJS.mode.CBC
  });
  return cipherText.toString();
}

function parseSinger(data: any) {
  return data && Array.isArray(data)
    ? data.map((n: any) => n.name).join(' / ')
    : '';
}

var downloadQuality: MusicQuality = 'PQ';
var playQuality: MusicQuality = 'PQ';

export function setDownloadQuality(quality: MusicQuality) {
  downloadQuality = quality;
  console.log(downloadQuality);
}

export function setPlayQuality(quality: MusicQuality) {
  playQuality = quality;
}

export async function search(
  keywords: string,
  offset: number = 0,
  limit: number = 30,
  type: number = 1
) {
  var url = 'https://interface.music.163.com/weapi/search/get';
  var data = {
    s: keywords.replace(/[\s]+/g, '+'),
    limit: limit,
    offset: offset,
    type: type,
    strategy: 5,
    queryCorrect: true
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=',
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.result.songCount;
  ret.result.songs.map((m: any) => {
    const album = m.al || m.album || {};
    list.push({
      id: m.id,
      name: m.name,
      highlightName: highlightKeys(m.name, keywords),
      image: (album.picUrl || '') + '?param=100y100',
      singer: parseSinger(m.ar || m.artists),
      album: album.name || '',
      albumId: album.id || '',
      duration: millisecond2Duration(m.dt || m.duration),
      length: m.dt || m.duration,
      vip: m.privilege && m.privilege.fee == 1,
      remark: '',
      type: musicType
    });
  });
  return {
    total,
    list
  };
}

export async function daily(): Promise<Playlist | null> {
  const now = new Date();
  return {
    id: 'daily',
    name: `每日推荐<br />${now.getFullYear()}-${
      now.getMonth() + 1
    }-${now.getDate()}`,
    image: '',
    type: musicType
  };
}

export async function yours(offset: number): Promise<{
  total: number;
  list: Playlist[];
}> {
  const list: Playlist[] = [];
  const dailyPlaylist = await daily();
  if (dailyPlaylist) list.push(dailyPlaylist);

  const csrfToken = cloudCookie['__csrf'] || '';
  const musicU = cloudCookie['MUSIC_U'] || '';
  var url = 'https://music.163.com/weapi/user/playlist?csrf_token=';
  const data = {
    uid: cloudCookie['uid'] || '',
    wordwrap: 7,
    limit: 50,
    offset: offset,
    lasttime: 0,
    total: true,
    csrf_token: csrfToken
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=' + musicU,
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  ret.playlist.map((m: any) => {
    list.push({
      id: m.id,
      name: m.name,
      description: m.description && m.description.replace(/\n+/g, '<br />'),
      image:
        m.coverImgUrl.toString().replace('http://', 'https://') +
        '?param=200y200',
      type: musicType
    });
  });

  return {
    total: list.length,
    list
  };
}

export async function recommend(offset: number) {
  var url = 'https://music.163.com/weapi/playlist/list';
  // var url = 'https://music.163.com/weapi/playlist/highquality/list';
  const data = {
    cat: '全部', // 全部,华语,欧美,日语,韩语,粤语,小语种,流行,摇滚,民谣,电子,舞曲,说唱,轻音乐,爵士,乡村,R&B/Soul,古典,民族,英伦,金属,朋克,蓝调,雷鬼,世界音乐,拉丁,另类/独立,New Age,古风,后摇,Bossa Nova,清晨,夜晚,学习,工作,午休,下午茶,地铁,驾车,运动,旅行,散步,酒吧,怀旧,清新,浪漫,性感,伤感,治愈,放松,孤独,感动,兴奋,快乐,安静,思念,影视原声,ACG,儿童,校园,游戏,70后,80后,90后,网络歌曲,KTV,经典,翻唱,吉他,钢琴,器乐,榜单,00后
    // order: 'hot', // hot,new
    limit: 30,
    offset: offset,
    lasttime: 0,
    total: true
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=',
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  const list: Playlist[] = [];
  const total: number = ret.total;
  ret.playlists.map((m: any) => {
    list.push({
      id: m.id,
      name: m.name,
      description: m.description && m.description.replace(/\n+/g, '<br />'),
      image:
        m.coverImgUrl.toString().replace('http://', 'https://') +
        '?param=200y200',
      type: musicType
    });
  });
  return {
    total,
    list
  };
}

export async function dailyPlayList(offset: number) {
  const csrfToken = cloudCookie['__csrf'] || '';
  const musicU = cloudCookie['MUSIC_U'] || '';
  const data = {
    offset: offset,
    total: true,
    csrf_token: csrfToken
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: 'https://music.163.com/weapi/v2/discovery/recommend/songs?csrf_token=',
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=' + musicU,
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  let total = 0;
  let list: Music[] = [];
  if (ret && ret.data && Array.isArray(ret.data.dailySongs)) {
    total = ret.data.dailySongs.length;
    ret.data.dailySongs.map((m: any) => {
      list.push({
        id: m.id,
        name: m.name,
        image: m.album.picUrl + '?param=100y100',
        singer: parseSinger(m.artists),
        album: m.album.name,
        albumId: m.album.id,
        duration: millisecond2Duration(m.duration),
        length: m.duration,
        vip: m.privilege && m.privilege.fee == 1,
        remark: '',
        type: musicType
      });
    });
  }
  let playlist = await daily();
  if (playlist) {
    playlist.name = playlist.name.replace('<br />', ' ');
    if (!playlist.image && list.length > 0) {
      playlist.image = list[0].image.replace('100y100', '300y300');
    }
  }
  return {
    total,
    list,
    playlist
  };
}

export async function playlistDetail(id: string, offset: number) {
  if (id == 'daily') {
    return dailyPlayList(offset);
  }
  if (id.startsWith('ranking')) {
    var rankingType = RankingType.Hot;
    switch (id) {
      case RankingNew:
        rankingType = RankingType.New;
        break;
      case RankingSoar:
        rankingType = RankingType.Soar;
        break;
    }
    const rankingList = await ranking(rankingType, offset);
    return {
      list: rankingList.list,
      total: rankingList.total,
      playlist: rankingPlaylist(rankingType)
    };
  }
  var url = 'https://music.163.com/weapi/v3/playlist/detail';
  const csrfToken = cloudCookie['__csrf'] || '';
  const musicU = cloudCookie['MUSIC_U'] || '';
  const data = {
    id: id,
    offset: offset,
    total: false,
    limit: 30,
    n: 1000,
    csrf_token: csrfToken
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=' + musicU,
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.playlist.id,
    name: ret.playlist.name,
    description:
      ret.playlist.description &&
      ret.playlist.description.replace(/\n+/g, '<br />'),
    image: ret.playlist.coverImgUrl,
    type: musicType
  };
  const total: number = ret.playlist.trackCount;
  ret.playlist.tracks.map((m: any) => {
    list.push({
      id: m.id,
      name: m.name,
      image: m.al.picUrl + '?param=100y100',
      singer: parseSinger(m.ar),
      album: m.al.name,
      albumId: m.al.id,
      duration: millisecond2Duration(m.dt),
      length: m.dt,
      vip: m.privilege && m.privilege.fee == 1,
      remark: '',
      type: musicType
    });
  });
  return {
    total,
    playlist,
    list
  };
}

export async function albumDetail(id: string) {
  var url = 'https://interface.music.163.com/weapi/v1/album/' + id;
  const data = {};
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=',
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.album.id,
    name: ret.album.name,
    description:
      (!ret.album.briefDesc &&
        ret.album.description &&
        ret.album.description.replace(/\n+/g, '<br />')) ||
      ret.album.artist.name ||
      '',
    image: ret.album.picUrl,
    type: musicType
  };
  const total: number = ret.songs.length;
  ret.songs.map((m: any) => {
    list.push({
      id: m.id,
      name: m.name,
      image: (m.al.picUrl || playlist.image) + '?param=100y100',
      singer: parseSinger(m.ar),
      album: m.al.name,
      albumId: m.al.id,
      duration: millisecond2Duration(m.dt),
      length: m.dt,
      vip: m.privilege && m.privilege.fee == 1,
      remark: '',
      type: musicType
    });
  });
  return {
    total,
    playlist,
    list
  };
}

export async function ranking(
  ranking: RankingType,
  offset: number
): Promise<{
  list: Music[];
  total: number;
}> {
  var playlistId = '';
  switch (ranking) {
    case RankingType.New:
      playlistId = '3779629';
      break;
    case RankingType.Soar:
      playlistId = '19723756';
      break;

    default:
      playlistId = '3778678';
      break;
  }
  return playlistDetail(playlistId, offset);
}
const RankingHot = 'rankinghot';
const RankingNew = 'rankingnew';
const RankingSoar = 'rankingsoar';

export function rankingPlaylist(ranking: RankingType): Playlist {
  var id = RankingHot;
  var name = '热歌榜';
  var image = RankingHotImage;
  switch (ranking) {
    case RankingType.New:
      id = RankingNew;
      name = '新歌榜';
      image = RankingNewImage;
      break;
    case RankingType.Soar:
      id = RankingSoar;
      name = '飙升榜';
      image = RankingSoarImage;
      break;
  }
  return {
    id,
    name: '网易云' + name,
    image,
    type: musicType
  };
}

export async function downloadUrl(
  music: Music,
  _quality?: MusicQuality
): Promise<string> {
  var url = 'http://music.163.com/weapi/song/enhance/player/url?csrf_token=';
  const csrfToken = cloudCookie['__csrf'] || '';
  const musicU = cloudCookie['MUSIC_U'] || '';
  const data = {
    ids: [music.id],
    br: 320000,
    csrf_token: csrfToken
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=' + musicU,
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  if (ret && ret.data && ret.data[0]) {
    return ret.data[0].url;
  }
  return '';
}

export async function musicDetail(music: Music) {
  music.url = await downloadUrl(music, playQuality);
  return music;
}

export async function musicById(id: string): Promise<Music | null> {
  var url = 'https://music.163.com/weapi/v3/song/detail';
  const data = {
    c: JSON.stringify([
      {
        id: id
      }
    ]),
    csrf_token: ''
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 'Zw8xKXE1jdYdGNpj');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=35f01c51527de6cc9aa39304cb4eeafb611f82cd0a15d86c3913d0e724711064b967b06204f2bc5623905d06bc9c3a9162369b5b68d8e9a408d8d11b8136030a1a8e68a0fc47979eb17509476ba482244402dbad953eeacfcfc5000c44cd875d4426e07ce5cb3e26930482c32ef7670f952e921e218683437115415670fb9282';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      ContentType: 'application/x-www-form-urlencoded'
    }
  });
  const ret = await res.json();
  if (ret && ret.songs && ret.songs[0]) {
    const m = ret.songs[0];
    return {
      id: m.id,
      name: m.name,
      image: m.al && m.al.picUrl,
      singer: parseSinger(m.ar),
      album: m.al && m.al.name,
      albumId: m.al && m.al.id,
      duration: millisecond2Duration(m.dt),
      length: m.dt,
      vip: m.privilege && m.privilege.fee == 1,
      type: musicType
    };
  }
  return null;
}

export async function lyric(music: Music): Promise<string> {
  if (!music.id) return '';
  const res = await httpProxy({
    url: 'https://music.163.com/api/song/lyric?lv=-1&id=' + music.id,
    method: 'GET'
  });
  const data = await res.json();
  const lyric: string = (data && data.lrc && data.lrc.lyric) || '';
  // const newlinesCount = lyric.match(/\n/g)?.length || 0;
  // if (newlinesCount < 5) {
  //   const resSearch = await search(music.name, 0, 30, 1006);
  //   for (let i = 0; i < resSearch.list.length; i++) {
  //     if (
  //       resSearch.list[i].duration == music.duration &&
  //       resSearch.list[i].name.includes(music.name.substring(0, 2))
  //     ) {
  //       const resL = await httpProxy({
  //         url:
  //           'https://music.163.com/api/song/lyric?lv=-1&id=' +
  //           resSearch.list[i].id,
  //         method: 'GET'
  //       });
  //       const dataL = await resL.json();
  //       if (dataL && dataL.lrc && dataL.lrc.lyric) return dataL.lrc.lyric;
  //     }
  //   }
  // }
  return lyric;
}

export async function lyricFuzzyMatch(music: Music): Promise<string> {
  if (!music.id || !music.duration) return '';
  let keywords = '';
  if (music.rawName) {
    keywords += music.rawName + ' ';
  }
  if (music.name && music.name != music.rawName) {
    keywords += music.name + ' ';
  }
  if (music.singer && !keywords.includes(music.singer)) {
    keywords += music.singer + ' ';
  }
  if (music.album && !keywords.includes(music.album)) {
    keywords += music.album + ' ';
  }
  keywords = keywords.replace(/\-/g, ' ').replace(/[\s]+/, ' ').trim();
  const res = await search(keywords);
  if (res.list.length === 0) return '';
  let lyricText = '';
  const localLength = music.length || duration2Millisecond(music.duration);
  for (let i = 0; i < res.list.length; i++) {
    if (res.list[i].duration == music.duration) {
      lyricText = await lyric(res.list[i]);
      break;
    }
  }
  if (!lyricText || (lyricText.match(/\n/g) || []).length < 5) {
    for (let i = 0; i < res.list.length; i++) {
      const remoteLength = duration2Millisecond(res.list[i].duration);
      if (
        keywords.includes(res.list[i].name) &&
        remoteLength < localLength + 3000 &&
        remoteLength > localLength - 3000
      ) {
        lyricText = await lyric(res.list[i]);
        break;
      }
    }
  }
  return lyricText;
}

export async function parseLink(link: string) {
  const matchCloud =
    /music\.163\.com[\S]+(song|playlist)[\S]*[\?&]id=([\d]+)/.exec(link);
  if (matchCloud) {
    return {
      linkType: matchCloud[1] == 'playlist' ? 'playlist' : 'music',
      id: matchCloud[2]
    };
  }
  return null;
}

export async function qrCodeKey(): Promise<{
  key: string;
  url: string;
} | null> {
  var url = 'https://music.163.com/weapi/login/qrcode/unikey?csrf_token=';
  const data = {
    type: 1,
    csrf_token: ''
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    headers: {
      Cookie: 'os=ios;MUSIC_U=',
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  if (ret && ret.unikey) {
    return {
      key: ret.unikey,
      url: await qrcodeGenerate(
        'http://music.163.com/login?codekey=' + ret.unikey
      )
    };
  }
  return null;
}

export async function loginStatus(key: string): Promise<{
  status: LoginStatus;
  user?: UserInfo;
}> {
  var url = 'https://music.163.com/weapi/login/qrcode/client/login?csrf_token=';
  const data = {
    key: key,
    type: 1,
    csrf_token: ''
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    setCookieRename: true,
    headers: {
      Cookie: 'os=ios;MUSIC_U=',
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  switch (ret && ret.code) {
    case 803:
      const cookies = parseCookie(res.headers.get('Set-Cookie-Renamed') || '');
      const user = await userInfo(cookies);
      if (user && user.id) {
        user.cookie = {
          __csrf: cookies['__csrf'] || '',
          MUSIC_U: cookies['MUSIC_U'] || '',
          uid: user.id.toString()
        };
        return {
          status: 'success',
          user
        };
      }
      break;
    case 801:
      return { status: 'waiting' };
    case 802:
      return { status: 'authorizing' };
  }
  return { status: 'fail' };
}

export async function userInfo(
  cookie: Record<string, string>
): Promise<UserInfo | null> {
  const csrfToken = cookie['__csrf'] || '';
  const musicU = cookie['MUSIC_U'] || '';
  var url = 'https://music.163.com/weapi/w/nuser/account/get?csrf_token=';
  const data = {
    csrf_token: csrfToken
  };
  var param = aesEncrypt(JSON.stringify(data), '0CoJUm6Qyw8W8jud');
  param = aesEncrypt(param, 't9Y0m4pdsoMznMlL');
  param = encodeURIComponent(param);
  var encSecKey =
    '&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053';
  var paramData = 'params=' + param + encSecKey;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: paramData,
    setCookieRename: true,
    headers: {
      Cookie: 'os=ios;MUSIC_U=' + musicU,
      Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded',
      UserAgent:
        'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
    }
  });
  const ret = await res.json();
  if (!ret || !ret.profile || !ret.profile.userId) return null;
  cloudCookie = {
    __csrf: csrfToken,
    MUSIC_U: musicU,
    uid: cookie['uid'] || ''
  };
  return {
    id: ret.profile.userId,
    name: ret.profile.nickname,
    image: ret.profile.avatarUrl
  };
}
