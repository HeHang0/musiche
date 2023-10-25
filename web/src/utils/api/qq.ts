import { httpProxy } from '../http';
import { Music, Playlist, MusicType, RankingType } from '../type';
import { generateGuid, millisecond2Duration } from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-soar.jpg';

function parseAlbumImage(music: any) {
  const albumPMId =
    (music.album && music.album.pmid) || music.albumpmid || music.pmid;
  if (albumPMId) {
    return `https://y.qq.com/music/photo_new/T002R300x300M000${albumPMId}.jpg`;
  }
  const albumMid = music.albummid || (music.album && music.album.mid);
  if (albumMid) {
    let s =
      albumMid[albumMid.length - 2] +
      '/' +
      albumMid[albumMid.length - 1] +
      '/' +
      albumMid;
    //003tMGHC2twSqj
    //
    //https://imgcache.qq.com/music/photo/mid_album_300/C/D/000aCoLU0WZjCD.jpg
    return `https://imgcache.qq.com/music/photo/mid_album_300/${s}.jpg`;
  }
  const singerMid = music.singer && music.singer[0] && music.singer[0].mid;
  if (singerMid) {
    return `https://y.gtimg.cn/music/photo_new/T001R300x300M000${singerMid}.jpg`;
  }
  return 'https://y.qq.com/mediastyle/global/img/album_300.png';
  //'https://y.qq.com/music/photo_new/T002R300x300M000' + almubMid + '_1.jpg'
}

export async function search(keywords: string, offset: number) {
  var url =
    'http://i.y.qq.com/s.music/fcgi-bin/search_for_qq_cp?' +
    'g_tk=938407465&uin=0&format=json&inCharset=utf-8&outCharset=utf-8' +
    `&notice=0&platform=h5&needNewCode=1&w=${encodeURIComponent(keywords)}` +
    `&flag=1&ie=utf-8&sem=1&aggr=0&perpage=30&n=30&p=${offset + 1}` +
    '&zhidaqu=1&catZhida=1&t=0&remoteplace=txt.mqq.all&_=1459991037831';
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  const json = await res.json();
  const ret = json['data']['song'];
  const list: Music[] = [];
  const total: number = ret.totalnum;
  ret.list.map((m: any) => {
    list.push({
      id: m.songmid,
      name: m.songname,
      highlightName: m.songname_hilight,
      image: parseAlbumImage(m),
      singer: Array.isArray(m.singer)
        ? m.singer.map((n: any) => n.name).join(' / ')
        : '',
      album: m.albumname,
      albumId: m.albummid,
      duration: millisecond2Duration(m.size128 / 16),
      length: m.size128 / 16,
      vip: Boolean(m.pay && m.pay.payplay),
      remark: '',
      type: MusicType.QQMusic
    });
  });
  return {
    total,
    list
  };
}

function removeExtJson(jsonStr: string) {
  jsonStr = jsonStr.replace(/^[a-zA-Z]{0,10}[C|c]allback\(/, '');
  jsonStr = jsonStr.replace(/;$/, '');
  jsonStr = jsonStr.replace(/\)$/, '');
  return jsonStr;
}

export async function recommend(offset: number) {
  var url =
    'https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg?' +
    'rnd=0.4781484879517406&g_tk=732560869&loginUin=0&hostUin=0' +
    '&format=json&inCharset=utf8&outCharset=utf-8&notice=0' +
    '&platform=yqq&needNewCode=0&categoryId=10000000&sortId=5' +
    `&sin=${offset * 35}&ein=${offset * 35 + 34}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  let json = await res.json();
  const ret = json['data'];
  const list: Playlist[] = [];
  const total: number = ret.sum;
  ret.list.map((m: any) => {
    list.push({
      id: m.dissid,
      name: m.dissname,
      type: MusicType.QQMusic,
      image: m.imgurl
        .toString()
        .replace('600?n=1', '150?n=1')
        .replace('http://', 'https://')
    });
  });
  return {
    total,
    list
  };
}

export async function playlistDetail1(id: string) {
  var url = `https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&nosign=1&disstid=${id}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=GB2312&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  let jsonStr = removeExtJson(await res.text());
  const ret = JSON.parse(jsonStr)['cdlist'][0];
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.dissid,
    name: ret.dissname,
    description: ret.desc && ret.desc.replace(/\n+/g, '<br />'),
    image: ret.logo,
    type: MusicType.QQMusic
  };
  const total: number = ret.total_song_num;
  ret.songlist.map((m: any) => {
    list.push({
      id: m.songmid,
      name: m.songname,
      image: parseAlbumImage(m),
      singer: Array.isArray(m.singer)
        ? m.singer.map((n: any) => n.name).join(' / ')
        : '',
      album: m.albumname,
      albumId: m.albummid,
      duration: millisecond2Duration(m.size128 / 16),
      length: m.size128 / 16,
      vip: Boolean(m.pay && m.pay.payplay),
      remark: '',
      type: MusicType.QQMusic
    });
  });
  return {
    list,
    total,
    playlist
  };
}

export async function playlistDetail(id: string) {
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
  var data = {
    comm: {
      g_tk: 5381,
      uin: 0,
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'h5',
      needNewCode: 1
    },
    req_0: {
      module: 'music.srfDissInfo.aiDissInfo',
      method: 'uniform_get_Dissinfo',
      param: {
        disstid: parseInt(id),
        enc_host_uin: '',
        tag: 1,
        userinfo: 1,
        song_begin: 0,
        song_num: 500
      }
    }
  };
  var url = `https://u.y.qq.com/cgi-bin/musicu.fcg?_webcgikey=uniform_get_Dissinfo`;
  var res = await httpProxy({
    url: url,
    method: 'POST',
    data: JSON.stringify(data),
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  const ret = await res.json();
  const resData = ret.req_0.data;
  const list: Music[] = [];
  const playlist: Playlist = {
    id: resData.dirinfo.id,
    name: resData.dirinfo.title,
    description:
      resData.dirinfo.desc && resData.dirinfo.desc.replace(/\n+/g, '<br />'),
    image: resData.dirinfo.picurl,
    type: MusicType.QQMusic
  };
  const total: number = resData.dirinfo.songnum;
  resData.songlist.map((m: any) => {
    const size = m.file.size_128mp3 / 16;
    list.push({
      id: m.mid,
      name: m.name,
      image: parseAlbumImage(m),
      singer: Array.isArray(m.singer)
        ? m.singer.map((n: any) => n.name).join(' / ')
        : '',
      album: m.album.name,
      albumId: m.album.mid,
      duration: millisecond2Duration(size),
      length: size,
      vip: Boolean(m.pay && (m.pay.payplay || m.pay.pay_play)),
      remark: '',
      type: MusicType.QQMusic
    });
  });
  return {
    list,
    total,
    playlist
  };
}

export async function albumDetail(id: string) {
  var url =
    'https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?' +
    'rnd=0.4781484879517406&g_tk=732560869&loginUin=0&hostUin=0' +
    '&format=json&inCharset=utf8&outCharset=utf-8&notice=0' +
    '&platform=yqq&needNewCode=0&categoryId=10000000&sortId=5' +
    `&albummid=${id}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  let ret = await res.json();
  const list: Music[] = [];
  let albummId = ret.data.mid;
  const albumImage = parseAlbumImage(ret.data);
  const playlist: Playlist = {
    id: albummId,
    name: ret.data.name,
    description: ret.data.desc,
    image: albumImage,
    type: MusicType.QQMusic
  };
  playlist.description = playlist.description?.replace(/\n+/g, '<br />');
  const total: number = ret.data.total_song_num;
  ret.data.list.map((m: any) => {
    list.push({
      id: m.songmid,
      name: m.songname,
      image: albumImage,
      singer: Array.isArray(m.singer)
        ? m.singer.map((n: any) => n.name).join(' / ')
        : '',
      album: m.albumname,
      albumId: m.albummid,
      duration: millisecond2Duration(m.size128 / 16),
      length: m.size128 / 16,
      vip: Boolean(m.pay && m.pay.payplay),
      remark: '',
      type: MusicType.QQMusic
    });
  });
  return {
    list,
    total,
    playlist
  };
}
const RankingHot = 'rankinghot';
const RankingNew = 'rankingnew';
const RankingSoar = 'rankingsoar';

export function rankingPlaylist(ranking: RankingType): Playlist {
  var id = RankingHot;
  var name = '热歌榜';
  var image = RankingHotImage;
  var desc = 'QQ音乐站内播放热度前300首歌曲，每日更新。';
  switch (ranking) {
    case RankingType.New:
      id = RankingNew;
      name = '新歌榜';
      image = RankingNewImage;
      desc = 'QQ音乐站内播放热度前100首新歌，每日更新。';
      break;
    case RankingType.Soar:
      id = RankingSoar;
      name = '飙升榜';
      desc = 'QQ音乐站内播放热度飙升最快的前100首歌曲，每日更新。';
      image = RankingSoarImage;
      break;
  }
  return {
    id,
    name: 'QQ音乐' + name,
    image,
    type: MusicType.QQMusic
  };
}

export async function ranking(ranking: RankingType) {
  var playlistId = '';
  switch (ranking) {
    case RankingType.New:
      playlistId = '27';
      break;
    case RankingType.Soar:
      playlistId = '4';
      break;

    default:
      playlistId = '26';
      break;
  }
  var now = new Date();
  if (now.getHours() < 10) {
    now = new Date(now.valueOf() - 172800000);
  } else {
    now = new Date(now.valueOf() - 86400000);
  }
  var date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  var url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?tpl=3&page=detail&date=${date}&topid=${playlistId}&type=top&song_begin=0&song_num=100&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;

  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.totalnum;
  ret.songlist.map((item: any) => {
    const m = item.data;
    list.push({
      id: m.songmid,
      name: m.songname,
      image: parseAlbumImage(m),
      singer: Array.isArray(m.singer)
        ? m.singer.map((n: any) => n.name).join(' / ')
        : '',
      album: m.albumname,
      albumId: m.albummid,
      duration: millisecond2Duration(m.size128 / 16),
      length: m.size128 / 16,
      vip: Boolean(m.pay && m.pay.payplay),
      remark: '',
      type: MusicType.QQMusic
    });
  });
  return {
    list,
    total
  };
}

export async function musicDetail2(music: Music) {
  const guid = generateGuid();
  //const fileType = {"128":{"s":"M500","e":".mp3"},"320":{"s":"M800","e":".mp3"},"m4a":{"s":"C400","e":".m4a"},"ape":{"s":"A000","e":".ape"},"flac":{"s":"F000","e":".flac"}}
  const songmidList = [music.id];
  const fileInfo = {
    s: 'M500',
    e: '.mp3'
  };
  const uin = '0';
  const file = songmidList.map(_ => `${fileInfo.s}${_}${_}${fileInfo.e}`);
  const data = {
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        filename: file,
        guid,
        songmid: songmidList,
        songtype: [0],
        uin,
        loginflag: 1,
        platform: '20'
      }
    },
    loginUin: uin,
    comm: {
      uin,
      format: 'json',
      ct: 24,
      cv: 0
    }
  };
  var res = await httpProxy({
    url:
      `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&sign=zzannc1o6o9b4i971602f3554385022046ab796512b7012&data=` +
      encodeURIComponent(JSON.stringify(data)),
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  let ret = await res.json();
  console.log(ret);
}

function getMusicDetailUrl(id: string, jsoup?: boolean) {
  const format = jsoup ? 'jsoup' : 'json';
  const guid = Math.abs(
    (Math.round(2147483647 * Math.random()) * new Date().valueOf()) % 1e10
  ).toString();
  const callback = jsoup ? `qqMusicUrl${guid}` : '';
  var data = {
    req: {
      module: 'CDN.SrfCdnDispatchServer',
      method: 'GetCdnDispatch',
      param: { guid: guid, calltype: 0, userip: '' }
    },
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: guid,
        songmid: [id],
        songtype: [0],
        uin: '0',
        loginflag: 1,
        platform: '20'
      }
    },
    comm: { uin: 0, format: format, ct: 20, cv: 0 }
  };

  var url =
    `https://u.y.qq.com/cgi-bin/musicu.fcg?callback=${callback}&g_tk=5381&platform=yqq` +
    `&jsonpCallback=${callback}&loginUin=0&hostUin=0&format=${format}&inCharset=utf8` +
    `&outCharset=utf-8&notice=0&needNewCode=0&data=${encodeURIComponent(
      JSON.stringify(data)
    )}`;
  return {
    url,
    callback
  };
}

function parseMusicUrl(ret: any) {
  if (
    ret &&
    ret.req_0 &&
    ret.req_0.data &&
    ret.req_0.data.midurlinfo &&
    ret.req_0.data.midurlinfo[0] &&
    ret.req_0.data.midurlinfo[0].purl
  ) {
    return (
      'http://dl.stream.qqmusic.qq.com/' + ret.req_0.data.midurlinfo[0].purl
    );
  }
  return '';
}

export async function musicDetail(
  music: Music,
  _jsoup?: boolean
): Promise<Music> {
  const { url, callback } = getMusicDetailUrl(music.id, true); //jsoup);
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com'
    }
  });
  var musicUrl = '';
  if (callback) {
    let callbackTimeout: any = null;
    let script: any = null;
    const ret = await new Promise(resolve => {
      (window as any)[callback] = resolve;
      script = document.createElement('script')!;
      script.src = url;
      document.head.appendChild(script);
      callbackTimeout = setTimeout(() => {
        delete (window as any)[callback];
        script?.remove();
        resolve(null);
      }, 5000);
    });
    script?.remove();
    clearTimeout(callbackTimeout);
    delete (window as any)[callback];
    musicUrl = parseMusicUrl(ret);
  } else {
    const ret = await res.json();
    musicUrl = parseMusicUrl(ret);
    if (!musicUrl) {
      return await musicDetail(music, true);
    }
  }
  music.url = musicUrl;
  return music;
}

const base64Header =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function decodeBase64(e: string) {
  for (
    var t, n, r, i, o, c, s = '', l = 0, u = e.replace(/[^A-Za-z0-9+/=]/g, '');
    l < e.length;

  )
    (t =
      (base64Header.indexOf(u.charAt(l++)) << 2) |
      ((i = base64Header.indexOf(u.charAt(l++))) >> 4)),
      (n = ((15 & i) << 4) | ((o = base64Header.indexOf(u.charAt(l++))) >> 2)),
      (r = ((3 & o) << 6) | (c = base64Header.indexOf(u.charAt(l++)))),
      (s += String.fromCharCode(t)),
      64 !== o && (s += String.fromCharCode(n)),
      64 !== c && (s += String.fromCharCode(r));
  return (s = (function (e) {
    for (var t = '', n = 0, a = 0, r = 0, i = 0; n < e.length; )
      (a = e.charCodeAt(n)) < 128
        ? ((t += String.fromCharCode(a)), n++)
        : a > 191 && a < 224
        ? ((r = e.charCodeAt(n + 1)),
          (t += String.fromCharCode(((31 & a) << 6) | (63 & r))),
          (n += 2))
        : ((r = e.charCodeAt(n + 1)),
          (i = e.charCodeAt(n + 2)),
          (t += String.fromCharCode(
            ((15 & a) << 12) | ((63 & r) << 6) | (63 & i)
          )),
          (n += 3));
    return t;
  })(s));
}

export async function lyric(music: Music) {
  if (!music.id) return '';
  const res = await httpProxy({
    url:
      'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?format=json&songmid=' +
      music.id,
    method: 'GET',
    headers: {
      referer: 'https://c.y.qq.com/'
    }
  });
  const data = await res.json();
  return (data && data.lyric && decodeBase64(data.lyric)) || '';
}
