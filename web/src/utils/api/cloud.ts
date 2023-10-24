import * as CryptoJS from 'crypto-js';
import { Music, MusicType, Playlist, RankingType } from '../type';
import { httpProxy } from '../http';
import { millisecond2Duration } from '../utils';

function aesEncrypt(plain: string, key: string): string {
  var iv = '0102030405060708';
  var cipherText = CryptoJS.AES.encrypt(plain, CryptoJS.enc.Utf8.parse(key), {
    iv: CryptoJS.enc.Utf8.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return cipherText.toString();
}

export async function search(keywords: string, offset: number) {
  var url = 'https://interface.music.163.com/weapi/search/get';
  var data = {
    s: keywords,
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
      singer: Array.isArray(m.ar)
        ? m.ar.map((n: any) => n.name).join(' / ')
        : '',
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

export async function playlistDetail(id: string) {
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
      singer: Array.isArray(m.ar)
        ? m.ar.map((n: any) => n.name).join(' / ')
        : '',
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
      singer: Array.isArray(m.ar)
        ? m.ar.map((n: any) => n.name).join(' / ')
        : '',
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

export async function ranking(ranking: RankingType) {
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

export async function lyric(music: Music) {
  if (!music.id) return '';
  const res = await httpProxy({
    url: 'https://music.163.com/api/song/lyric?lv=-1&id=' + music.id,
    method: 'GET'
  });
  const data = await res.json();
  return (data && data.lrc && data.lrc.lyric) || '';
}
