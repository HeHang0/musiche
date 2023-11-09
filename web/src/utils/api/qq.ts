import { httpProxy, parseHttpProxyAddress } from '../http';
import {
  Music,
  Playlist,
  MusicType,
  RankingType,
  UserInfo,
  LoginStatus,
  MusicQuality
} from '../type';
import {
  formatCookies,
  generateGuid,
  highlightKeys,
  millisecond2Duration
} from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-soar.jpg';

const musicType: MusicType = 'qq';

var qqCookie: string = '';

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

function parseMusic(m: any): Music {
  const fileName = Array.isArray(m.vs) ? m.vs.find((n: any) => n) : void 0;
  const size = Math.round(
    (m.size128 || (m.file && m.file.size_128mp3) || 0) / 16
  );
  return {
    id: m.songmid || m.mid,
    name: m.songname || m.name,
    image: parseAlbumImage(m),
    singer: Array.isArray(m.singer)
      ? m.singer.map((n: any) => n.name).join(' / ')
      : '',
    album: m.albumname || (m.album && m.album.name) || '',
    albumId: m.albummid || (m.album && m.album.mid) || '',
    duration: millisecond2Duration(size),
    length: size,
    vip: Boolean(m.pay && (m.pay.payplay || m.pay.pay_play)),
    remark: fileName ? `RS02${fileName}.mp3` : void 0,
    type: musicType
  };
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

export async function search(keywords: string, offset: number) {
  var res = await httpProxy({
    url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
    method: 'POST',
    data: JSON.stringify({
      comm: {
        mina: 1,
        appid: 'wxada7aab80ba27074',
        ct: 25
      },
      req: {
        method: 'DoSearchForQQMusicMobile',
        module: 'music.search.SearchBrokerCgiServer',
        param: {
          remoteplace: 'miniapp.wxada7aab80ba27074',
          search_type: 7,
          query: keywords,
          page_num: Math.round(offset / 30) + 1,
          num_per_page: 30,
          grp: 0
        }
      }
    }),
    headers: {
      'content-type': 'application/json'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.req.data.meta.sum;
  ret.req.data.body.item_song.map((m: any) => {
    const music = parseMusic(m);
    music.highlightName = highlightKeys(music.name, keywords);
    list.push(music);
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

export async function daily(): Promise<Playlist | null> {
  var url = 'https://c.y.qq.com/node/musicmac/v6/index.html';
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com',
      Cookie: qqCookie
    }
  });
  const html = await res.text();
  const matchId = /data-rid="([\d]+)"[\s]*[\S]+[\s]*今日私享/.exec(html);
  const matchImage = /src="([\S]+?)"[\s]+alt="今日私享/.exec(html);
  if (matchId && matchImage) {
    return {
      id: matchId[1],
      name: '今日私享',
      image: matchImage[1],
      type: musicType
    };
  }
  return null;
}

export async function yours(_offset: number): Promise<{
  total: number;
  list: Playlist[];
}> {
  const list: Playlist[] = [];
  const dailyPlaylist = await daily();
  if (dailyPlaylist) list.push(dailyPlaylist);
  var res = await httpProxy({
    url: 'https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&reqfrom=1',
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com',
      Cookie: qqCookie
    }
  });
  let ret = await res.json();
  function _pushList(retList: any[]) {
    retList.map((m: any) => {
      list.push({
        id: m.dissid || m.id,
        name: m.title,
        type: musicType,
        image: m.picurl && parseHttpProxyAddress(m.picurl)
      });
    });
  }
  if (ret.data.mymusic) _pushList(ret.data.mymusic);
  if (ret.data.mydiss.list) _pushList(ret.data.mydiss.list);
  return {
    total: list.length,
    list
  };
}

export async function recommendFirst(offset: number) {
  var url =
    `https://u.y.qq.com/cgi-bin/musicu.fcg?callback=&g_tk=5381&platform=yqq` +
    `&jsonpCallback=&loginUin=0&hostUin=0&format=json&inCharset=utf8` +
    `&outCharset=utf-8&notice=0&needNewCode=0&data=${encodeURIComponent(
      JSON.stringify({
        comm: {
          cv: 4747474,
          ct: 24,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          platform: 'yqq.json',
          needNewCode: 1,
          uin: 0,
          g_tk_new_20200303: 5381,
          g_tk: 5381
        },
        req_1: {
          method: 'GetRecommendWhole',
          module: 'music.playlist.PlaylistSquare',
          param: { IsReqFeed: true, FeedReq: { From: offset, Size: 30 } }
        }
      })
    )}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com',
      Cookie: qqCookie
    }
  });
  let json = await res.json();
  const ret = json.req_1.data.FeedRsp;
  const list: Playlist[] = [];
  const total: number = ret.FromLimit;
  ret.List.map((m: any) => {
    list.push({
      id: m.Playlist.basic.tid,
      name: m.Playlist.basic.title,
      type: musicType,
      image: m.Playlist.basic.cover.default_url
        .toString()
        .replace('300?n=1', '150?n=1')
        .replace('http://', 'https://')
    });
  });
  return {
    total,
    list
  };
}

export async function recommend(offset: number) {
  try {
    return await recommendFirst(offset);
  } catch {}
  var url =
    'https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg?' +
    'rnd=0.4781484879517406&g_tk=732560869&loginUin=0&hostUin=0' +
    '&format=json&inCharset=utf8&outCharset=utf-8&notice=0' +
    '&platform=yqq&needNewCode=0&categoryId=10000000&sortId=5' +
    `&sin=${offset}&ein=${offset + 30}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      Referer: 'http://y.qq.com',
      Cookie: qqCookie
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
      type: musicType,
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
    type: musicType
  };
  const total: number = ret.total_song_num;
  ret.songlist.map((m: any) => {
    list.push(parseMusic(m));
  });
  return {
    list,
    total,
    playlist
  };
}

export async function playlistDetail(id: string, offset: number) {
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
        song_begin: offset,
        song_num: offset + 30
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
    type: musicType
  };
  const total: number = resData.dirinfo.songnum;
  resData.songlist.map((m: any) => {
    list.push(parseMusic(m));
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
    type: musicType
  };
  playlist.description = playlist.description?.replace(/\n+/g, '<br />');
  const total: number = ret.data.total_song_num;
  ret.data.list.map((m: any) => {
    list.push(parseMusic(m));
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
    description: desc,
    type: musicType
  };
}

export async function rankingFirst(ranking: RankingType, offset: number) {
  let now = new Date();
  if (now.getHours() < 10) now = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${month}-${day}`;
  var playlistId = 26;
  switch (ranking) {
    case RankingType.New:
      playlistId = 27;
      break;
    case RankingType.Soar:
      playlistId = 62;
      break;
  }
  var url =
    `https://u.y.qq.com/cgi-bin/musicu.fcg?callback=&g_tk=5381&platform=yqq` +
    `&jsonpCallback=&loginUin=0&hostUin=0&format=json&inCharset=utf8` +
    `&outCharset=utf-8&notice=0&needNewCode=0&data=${encodeURIComponent(
      JSON.stringify({
        comm: {
          cv: 4747474,
          ct: 24,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          platform: 'yqq.json',
          needNewCode: 1,
          uin: 0,
          g_tk_new_20200303: 5381,
          g_tk: 5381
        },
        req_1: {
          module: 'musicToplist.ToplistInfoServer',
          method: 'GetDetail',
          param: { topid: playlistId, offset: offset, num: 20, period: date }
        }
      })
    )}`;
  const res = await httpProxy({
    url,
    method: 'GET',
    headers: {
      Referer: 'http://y.qq.com',
      Cookie: qqCookie
    }
  });
  let json = await res.json();
  const total: number = json.req_1.data.data.totalNum;
  const list: Music[] = [];
  json.req_1.data.songInfoList.map((m: any) => {
    list.push(parseMusic(m));
  });
  return {
    list,
    total
  };
}

export async function ranking(ranking: RankingType, offset: number) {
  try {
    return rankingFirst(ranking, offset);
  } catch {}
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
    list.push(parseMusic(m));
  });
  return {
    list,
    total
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
    const urlPrefix =
      ret.req_0.data.sip.find((m: any) => Boolean(m)) ||
      'http://dl.stream.qqmusic.qq.com/';
    return urlPrefix + ret.req_0.data.midurlinfo[0].purl;
  }
  return '';
}

export async function downloadUrl(
  music: Music,
  _quality?: MusicQuality,
  audition?: boolean
): Promise<string> {
  var res = await httpProxy({
    url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
    method: 'POST',
    data: JSON.stringify({
      comm: {
        cv: 4747474,
        ct: 24,
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 1
      },
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: generateGuid().substring(0, 10),
          songmid: [music.id],
          songtype: [0],
          uin: '',
          loginflag: 1,
          platform: '20',
          filename: audition && music.remark ? [music.remark] : []
        }
      }
    }),
    headers: {
      Referer: 'https://y.qq.com',
      Cookie: qqCookie
    }
  });
  const ret = await res.json();
  return parseMusicUrl(ret);
}

export async function musicDetail(music: Music): Promise<Music> {
  music.url = await downloadUrl(music, playQuality);
  if (!music.url) {
    music.url = await downloadUrl(music, playQuality, true);
    music.audition = true;
  }
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

export async function lyric(music: Music): Promise<string> {
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

export async function parseLink(link: string) {
  const matchQQ = /qq\.com[\S]+[\S]*[\?&]id=([\d]+)/.exec(link);
  if (matchQQ) {
    return {
      linkType: 'playlist',
      id: matchQQ[1]
    };
  }
  return null;
}

export async function loginStatus(cookie: string): Promise<{
  status: LoginStatus;
  user?: UserInfo;
}> {
  const user = await userInfo(cookie);
  if (user && user.id) {
    user.cookie = cookie;
    return {
      status: 'success',
      user
    };
  }
  return {
    status: 'fail'
  };
}

export async function userInfo(cookies: string): Promise<UserInfo | null> {
  qqCookie = cookies;
  const cookie = formatCookies(cookies);
  var res = await httpProxy({
    url: 'https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&reqfrom=1',
    method: 'GET',
    headers: {
      Referer: 'https://y.qq.com',
      Cookie: cookie
    }
  });
  const ret = await res.json();
  const creator = (ret && ret.data && ret.data.creator) || null;
  if (!creator || !creator.encrypt_uin) return null;
  return {
    id: creator.encrypt_uin,
    name: creator.nick,
    image: creator.headpic
  };
}
