import * as CryptoJS from 'crypto-js';
import { Music, MusicType, Playlist, RankingType, UserInfo } from '../type';
import { httpProxy } from '../http';
import { millisecond2Duration } from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-soar.jpg';

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

export async function search(keywords: string, offset: number) {
  var url = 'https://interface.music.163.com/weapi/search/get';
  var data = {
    s: keywords.replace(/[\s]+/g, '+'),
    limit: 30,
    offset: offset * 30,
    type: 1,
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
  var keys = keywords.split(/[\s]+/);
  ret.result.songs.map((m: any) => {
    var highlightName = m.name;
    keys.map(n => {
      highlightName = highlightName.replace(
        n,
        `<span class="c_tx_highlight">${n}</span>`
      );
    });
    list.push({
      id: m.id,
      name: m.name,
      highlightName: highlightName,
      image: m.al.picUrl + '?param=100y100',
      singer: parseSinger(m.ar),
      album: m.al.name,
      albumId: m.al.id,
      duration: millisecond2Duration(m.dt),
      length: m.dt,
      vip: m.privilege && m.privilege.fee == 1,
      remark: '',
      type: MusicType.CloudMusic
    });
  });
  return {
    total,
    list
  };
}

export async function daily(
  _cookies: Record<string, string>
): Promise<Playlist | null> {
  const now = new Date();
  return {
    id: 'daily',
    name: `每日推荐<br />${now.getFullYear()}-${
      now.getMonth() + 1
    }-${now.getDate()}`,
    image: '',
    type: MusicType.CloudMusic
  };
}

export async function yours(
  cookies: Record<string, string>,
  offset: number
): Promise<{
  total: number;
  list: Playlist[];
}> {
  const list: Playlist[] = [];
  const dailyPlaylist = await daily(cookies);
  if (dailyPlaylist) list.push(dailyPlaylist);

  const csrfToken = cookies['__csrf'] || '';
  const musicU = cookies['MUSIC_U'] || '';
  var url = 'https://music.163.com/weapi/user/playlist?csrf_token=';
  const data = {
    uid: cookies['uid'] || '',
    wordwrap: 7,
    limit: 50,
    offset: offset * 50,
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
      type: MusicType.CloudMusic
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
    limit: 50,
    offset: offset * 50,
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
      type: MusicType.CloudMusic
    });
  });
  return {
    total,
    list
  };
}

export async function dailyPlayList(cookies: Record<string, string>) {
  const csrfToken = cookies ? cookies['__csrf'] || '' : '';
  const musicU = cookies ? cookies['MUSIC_U'] || '' : '';
  const data = {
    offset: 0,
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
        type: MusicType.CloudMusic
      });
    });
  }
  let playlist = await daily(cookies);
  if (playlist) playlist.name = playlist.name.replace('<br />', ' ');
  return {
    total,
    list,
    playlist
  };
}

export async function playlistDetail(
  id: string,
  cookies?: Record<string, string>
) {
  if (id == 'daily') {
    return dailyPlayList(cookies!);
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
    const rankingList = await ranking(rankingType);
    return {
      list: rankingList.list,
      total: rankingList.total,
      playlist: rankingPlaylist(rankingType)
    };
  }
  var url = 'https://music.163.com/weapi/v3/playlist/detail';
  const data = {
    id: id,
    offset: 0,
    total: true,
    limit: 1000,
    n: 1000,
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
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.playlist.id,
    name: ret.playlist.name,
    description:
      ret.playlist.description &&
      ret.playlist.description.replace(/\n+/g, '<br />'),
    image: ret.playlist.coverImgUrl,
    type: MusicType.CloudMusic
  };
  const total: number = ret.playlist.tracks.length;
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
      type: MusicType.CloudMusic
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
    type: MusicType.CloudMusic
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
      type: MusicType.CloudMusic
    });
  });
  return {
    total,
    playlist,
    list
  };
}

export async function ranking(ranking: RankingType): Promise<{
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
  return playlistDetail(playlistId);
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
    type: MusicType.CloudMusic
  };
}

export async function musicDetail(music: Music) {
  var url = 'http://music.163.com/weapi/song/enhance/player/url?csrf_token=';
  const data = {
    ids: [music.id],
    br: 320000,
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
  if (ret && ret.data && ret.data[0]) {
    music.url = ret.data[0].url;
  }
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
      // Cookie: 'os=ios;MUSIC_U=',
      // Referer: 'https://music.163.com',
      ContentType: 'application/x-www-form-urlencoded'
      // UserAgent:
      //   'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1',
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
      type: MusicType.CloudMusic
    };
  }
  return null;
}

export async function lyric(music: Music) {
  if (!music.id) return '';
  const res = await httpProxy({
    url: 'https://music.163.com/api/song/lyric?lv=-1&id=' + music.id,
    method: 'GET'
  });
  const data = await res.json();
  return (data && data.lrc && data.lrc.lyric) || '';
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
  url?: string;
}> {
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
  return {
    key: (ret && ret.unikey) || ''
  };
}

export async function qrCodeState(key: string): Promise<{
  state: number | string;
  cookie: string;
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
  return {
    state: (ret && ret.code) || 0,
    cookie: res.headers.get('Set-Cookie-Renamed') || ''
  };
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
  return {
    id: ret.profile.userId,
    name: ret.profile.nickname,
    image: ret.profile.avatarUrl
  };
}
