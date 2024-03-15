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
  getUuid,
  highlightKeys,
  millisecond2Duration,
  parseCookie
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
    return `https://y.qq.com/music/photo_new/T002R300x300M000${albumPMId}.jpg?max_age=2592000`;
  }
  const albumMid =
    music.albumMid || music.albummid || (music.album && music.album.mid);
  if (albumMid) {
    let s =
      albumMid[albumMid.length - 2] +
      '/' +
      albumMid[albumMid.length - 1] +
      '/' +
      albumMid;
    return `https://imgcache.qq.com/music/photo/mid_album_300/${s}.jpg?max_age=2592000`;
  }
  const singerMid = music.singer && music.singer[0] && music.singer[0].mid;
  if (singerMid) {
    return `https://y.gtimg.cn/music/photo_new/T001R300x300M000${singerMid}.jpg?max_age=2592000`;
  }
  return 'https://y.qq.com/mediastyle/global/img/album_300.png';
}

function parseMusic(m: any): Music {
  const fileName = (m.file && m.file.media_mid) || m.vs?.find((n: any) => n);
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
}

export function setPlayQuality(quality: MusicQuality) {
  playQuality = quality;
}

export function getCookie() {
  return qqCookie;
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

async function getRankingFirstData(
  playlistId: number,
  offset: number,
  date: string
) {
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
  return await res.json();
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
  const list: Music[] = [];
  let json = await getRankingFirstData(playlistId, offset, date);
  let total: number = json.req_1.data.data.totalNum;
  if (
    !json.req_1.data.songInfoList ||
    json.req_1.data.songInfoList.length === 0
  ) {
    json = await getRankingFirstData(
      playlistId,
      offset,
      `${now.getFullYear()}-${month}-${(now.getDate() - 1)
        .toString()
        .padStart(2, '0')}`
    );
    total = json.req_1.data.data.totalNum;
  }
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
  var url =
    'https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?tpl=3' +
    '&song_num=100&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8' +
    '&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0' +
    `&page=detail&date=${date}&topid=${playlistId}&type=top&song_begin=0`;
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
    const urlPrefix: string =
      ret.req_0.data.sip.find((m: any) => Boolean(m)) ||
      'https://dl.stream.qqmusic.qq.com/';
    return (
      urlPrefix.replace('http://', 'https://') +
      ret.req_0.data.midurlinfo[0].purl
    );
  }
  return '';
}

export async function downloadUrl(
  music: Music,
  _quality?: MusicQuality,
  audition?: boolean
): Promise<string> {
  if (!_quality) _quality = downloadQuality;
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

export async function musicById(id: string): Promise<Music | null> {
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
        method: 'get_song_detail_yqq',
        module: 'music.pf_song_detail_svr',
        param: { song_mid: id }
      }
    }),
    headers: {
      Referer: 'https://y.qq.com',
      Cookie: qqCookie
    }
  });
  const ret = await res.json();
  return parseMusic(ret.req_0.data.track_info);
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

export async function qrCodeKey(): Promise<{
  key: string;
  url?: string;
}> {
  var res = await httpProxy({
    url:
      'https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&daid=383&pt_3rd_aid=100497308&t=' +
      new Date().getTime(),
    method: 'GET',
    setCookieRename: true
  });
  const ret = await res.arrayBuffer();
  var cookies = parseCookie(res.headers.get('Set-Cookie-Renamed') || '');
  return {
    key: cookies.qrsig || '',
    url:
      'data:image/png;base64,' +
      btoa(String.fromCharCode(...new Uint8Array(ret)))
  };
}

export async function loginStatus(key: string): Promise<{
  status: LoginStatus;
  user?: UserInfo;
}> {
  let hash33 = function (t: string) {
    for (var e = 0, n = 0, o = t.length; n < o; ++n)
      e += (e << 5) + t.charCodeAt(n);
    return 2147483647 & e;
  };
  const url =
    `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent(
      'https://graph.qq.com/oauth2.0/login_jump'
    )}&ptqrtoken=${hash33(
      key
    )}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2502&action=0-0-${Date.now()}` +
    '&js_ver=22080914&js_type=1&login_sig=&pt_uistyle=40&aid=716027609&daid=383' +
    '&pt_3rd_aid=100497308&o1vId=49283d5cbb01a744d46314da4608d929';
  var res = await httpProxy({
    url: url,
    method: 'GET',
    headers: {
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: 'qrsig=' + key,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
    },
    setCookieRename: true
  });
  const text = await res.text();
  const regex = /[\S]*\('(\d+)','[\d]+','([^']*)',[\s\S]+\)/;
  const match = regex.exec(text);
  const code = match && parseInt(match[1]);
  switch (code) {
    case 0:
      const lastCookie = parseCookie(
        res.headers.get('Set-Cookie-Renamed') || ''
      );
      const ui = getUuid();
      lastCookie['ui'] = ui;
      res = await httpProxy({
        url: match![2],
        method: 'GET',
        headers: {
          Referer: 'https://xui.ptlogin2.qq.com/',
          'Sec-Fetch-Dest': 'iframe',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-site',
          'Upgrade-Insecure-Requests': '1',
          Cookie: formatCookies({
            ui: ui,
            _qpsvr_localtk: '0.7235980088190543',
            RK: lastCookie['RK'],
            ptcz: lastCookie['ptcz']
          }),
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
        },
        allowAutoRedirect: false,
        setCookieRename: true
      });
      const redirectRet = await res.json();
      console.log(redirectRet);
      const cookies = parseCookie(
        res.headers.get('Set-Cookie-Renamed') ||
          redirectRet['Set-Cookie-Renamed']
      );
      const str = cookies['p_skey'] || '';
      let hash = 5381;
      for (var i = 0, len = str.length; i < len; ++i) {
        hash += (hash << 5) + str.charCodeAt(i);
      }
      const g_tk = hash & 0x7fffffff;
      // const data = {
      //   response_type: 'code',
      //   client_id: '100497308',
      //   redirect_uri:
      //     'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
      //   scope: 'all',
      //   state: 'state',
      //   switch: '',
      //   from_ptlogin: '1',
      //   src: '1',
      //   update_auth: '1',
      //   openapi: '80901010_1030',
      //   g_tk: g_tk,
      //   auth_time: Date.now(),
      //   ui: ui
      // };
      const data = {
        response_type: 'code',
        client_id: '100497308',
        redirect_uri:
          'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
        scope: '',
        state: 'state',
        switch: '',
        from_ptlogin: 1,
        src: 1,
        update_auth: 1,
        openapi: '1010_1030',
        g_tk: g_tk,
        auth_time: Date.now(),
        ui: ui
      };
      const cookieStr = formatCookies({ ...lastCookie, ...cookies });
      res = await httpProxy({
        url: 'https://graph.qq.com/oauth2.0/authorize',
        method: 'POST',
        data: JSON.stringify(data),
        headers: {
          Referer: 'https://xui.ptlogin2.qq.com/',
          Cookie: cookieStr,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
        },
        allowAutoRedirect: false,
        setCookieRename: true
      });
      const authorizeRet = await res.json();
      console.log(authorizeRet.Location);
      const codeMatch = /&code=(.*?)&/.exec(authorizeRet.Location);
      const code = codeMatch ? codeMatch[1] : '';
      const uData = `{"comm":{"g_tk":5381,"platform":"yqq","ct":24,"cv":0},"req":{"module":"QQConnectLogin.LoginServer","method":"QQLogin","param":{"code":"${code}"}}}`;
      res = await httpProxy({
        url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
        method: 'POST',
        data: uData,
        headers: {
          Cookie: cookieStr
        },
        setCookieRename: true
      });
      const qqCookie = parseCookie(res.headers.get('Set-Cookie-Renamed') || '');
      const loginRet = await res.text();
      console.log(loginRet);
      console.log(qqCookie);
      const user = await userInfo(res.headers.get('Set-Cookie-Renamed') || '');
      if (user && user.id) {
        user.cookie = cookies;
        return {
          status: 'success',
          user
        };
      }
      return { status: 'waiting' };
    case 66:
      return { status: 'waiting' };
    case 67:
      return { status: 'authorizing' };
  }
  return { status: 'fail' };
}

// export async function loginStatus(cookie: string): Promise<{
//   status: LoginStatus;
//   user?: UserInfo;
// }> {
//   const user = await userInfo(cookie);
//   if (user && user.id) {
//     user.cookie = cookie;
//     return {
//       status: 'success',
//       user
//     };
//   }
//   return {
//     status: 'fail'
//   };
// }

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
