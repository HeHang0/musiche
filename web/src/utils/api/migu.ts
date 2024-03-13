import { httpProxy, parseHttpProxyAddress } from '../http';
import {
  LoginStatus,
  Music,
  MusicQuality,
  MusicType,
  Playlist,
  RankingType,
  UserInfo
} from '../type';
import {
  duration2Millisecond,
  durationTrim,
  formatCookies,
  highlightKeys,
  millisecond2Duration,
  parseCookie,
  second2Duration
} from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-original.jpg';

const musicType: MusicType = 'migu';

var miguCookie: string = '';

var miguUid: string = localStorage.getItem('musiche-migu-uid') || '';

function padProtocol(url: string) {
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

function parseImage(data: any) {
  if (!data)
    return {
      image: '',
      mediumImage: void 0,
      largeImage: void 0
    };
  let smallImage = '';
  let mediumImage = '';
  let largeImage = '';
  if (Array.isArray(data.albumImgs)) {
    smallImage = data.albumImgs.find(
      (m: { imgSizeType: string }) => m.imgSizeType === '01'
    )?.img;
    mediumImage = data.albumImgs.find(
      (m: { imgSizeType: string }) => m.imgSizeType === '02'
    )?.img;
    largeImage = data.albumImgs.find(
      (m: { imgSizeType: string }) => m.imgSizeType === '03'
    )?.img;
  } else if (typeof data === 'string') {
    smallImage = data;
    mediumImage = smallImage;
    largeImage = smallImage;
  } else if (data.playListPic || data.image || data.picUrl) {
    smallImage = data.playListPic || data.image || data.picUrl;
  } else if (data.imageUrl) {
    smallImage = data.imageUrl;
    mediumImage = smallImage;
    largeImage = smallImage;
  } else {
    smallImage = data.smallPic || data.mediumPic || '';
    mediumImage = data.mediumPic || '';
    largeImage = data.largePic || '';
  }
  return {
    image: padProtocol(smallImage || ''),
    mediumImage: padProtocol(mediumImage || ''),
    largeImage: padProtocol(largeImage || '')
  };
}

function parseSinger(data: any) {
  return data && Array.isArray(data)
    ? data.map((n: any) => n.name).join(' / ')
    : '';
}

function parseMusic(data: any): Music | null {
  if (!data) return null;
  const image = parseImage(data);
  const album = data.album || (data.albums && data.albums[0]) || {};
  let duration = '';
  let length = 0;
  if (data.duration && typeof data.duration === 'number') {
    length = data.duration * 1000;
  } else if (data.length && typeof data.length === 'string') {
    duration = durationTrim(data.length);
  }
  if (duration && !length) {
    length = duration2Millisecond(duration);
  }
  if (length && !duration) {
    duration = millisecond2Duration(length);
  }
  return {
    id: data.copyrightId,
    name: data.name || data.songName,
    image: image.image,
    mediumImage: image.mediumImage,
    largeImage: image.largeImage,
    singer: parseSinger(data.singers),
    album: album.name || album.albumName || '',
    albumId: album.id || album.albumId || '',
    duration: duration,
    length: length,
    vip: (data.vipFlag || (data.fullSong && data.fullSong.vipFlag)) == 1,
    remark: (data.fullSong && data.fullSong.productId) || data.songId,
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
  return { cookie: miguCookie, uid: miguUid };
}

export async function search(keywords: string, offset: number) {
  var url = `https://m.music.migu.cn/migumusic/h5/search/all?text=${encodeURIComponent(
    keywords
  ).replace(/%20/g, '+')}&pageNo=${Math.round(offset / 30) + 1}&pageSize=30`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/search',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.data.songsData.total;
  ret.data.songsData.items.map((m: any) => {
    const music = parseMusic(m);
    music && list.push(music);
  });
  highlightKeys(list, keywords);
  return {
    total,
    list
  };
}

export async function daily(): Promise<Playlist | null> {
  return {
    id: 'daily',
    name: '你会喜欢',
    image: 'https://d.musicapp.migu.cn/data/oss/service66/00/2b/0z/4i',
    type: musicType
  };
}

export async function yours(_offset: number): Promise<{
  total: number;
  list: Playlist[];
}> {
  const list: Playlist[] = [];
  const urls = [
    'https://music.migu.cn/v3/api/my/playlist/list',
    'https://music.migu.cn/v3/api/my/collect/list?type=playlist',
    'https://music.migu.cn/v3/api/my/digitalAlbum/list'
  ];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    var res = await httpProxy({
      url: url,
      method: 'GET',
      headers: {
        Referer: 'https://music.migu.cn/v3',
        Cookie: miguCookie
      }
    });
    const ret = await res.json();
    var retList = ret.playLists || (ret.data && ret.data.items) || ret.data;
    if (retList) {
      retList.map((m: any) => {
        list.push({
          id: m.id || m.playListId,
          name: m.playListName || m.name,
          image: parseImage(m).image,
          type: musicType
        });
      });
    }
  }
  const dailyPlaylist = await daily();
  if (dailyPlaylist) list.unshift(dailyPlaylist);

  return {
    total: list.length,
    list
  };
}

export async function recommend(offset: number) {
  var url = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/template/musiclistplaza-listbytag/release?pageNumber=${
    Math.floor(offset / 30) + 1
  }&tagId=1003449976`;
  var res = await httpProxy({
    url: url,
    method: 'GET'
  });
  const ret = await res.json();
  const list: Playlist[] = [];
  let total: number = offset + 60;
  if (ret.data.contentItemList.itemList.length == 0) {
    total = offset;
  }
  ret.data.contentItemList.itemList.map((m: any) => {
    list.push({
      id: m.logEvent.contentId,
      name: m.title,
      image: parseImage(m).image,
      type: musicType
    });
  });
  return {
    total,
    list
  };
}

export async function playlistInfo(id: string) {
  var url =
    'https://m.music.migu.cn/migumusic/h5/playlist/info?songListId=' + id;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/playlist',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  let total = 0;
  if (
    ret &&
    ret.data &&
    ret.data.contentCount &&
    /^[\d]+$/.test(ret.data.contentCount)
  ) {
    total = parseInt(ret.data.contentCount);
  }
  return {
    id: ret.data.playListId,
    name: ret.data.playListName,
    description: ret.data.summary && ret.data.summary.replace(/\n+/g, '<br />'),
    image: parseImage(ret.data.image).image,
    total: total,
    type: musicType
  };
}

export async function dailyPlayList(_offset: number) {
  const headers: Record<string, string> = {
    Referer: 'https://music.migu.cn/v3',
    Cookie: miguCookie
  };
  let res = await httpProxy({
    url: 'https://music.migu.cn/v3/api/music/index/39',
    method: 'GET',
    data: '',
    headers: headers
  });
  let ret = await res.json();
  const ids = (ret && ret.data && ret.data.join('%2C')) || '';
  let total = 0;
  const list: Music[] = [];
  let playlist: Playlist | null = null;
  if (!ids)
    return {
      total,
      list,
      playlist
    };
  headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  res = await httpProxy({
    url: 'https://music.migu.cn/v3/api/music/audioPlayer/songs',
    method: 'POST',
    data: 'type=1&copyrightId=' + ids,
    headers: headers
  });
  ret = await res.json();
  if (ret && Array.isArray(ret.items)) {
    total = ret.items.length;
    ret.items.map((m: any) => {
      list.push({
        id: m.copyrightId,
        name: m.songName,
        image: '',
        singer: Array.isArray(m.singers)
          ? m.singers.map((n: any) => n.artistName).join(' / ')
          : '',
        album: (m.albums && m.albums[0].albumName) || '',
        albumId: (m.albums && m.albums[0].albumId) || '',
        duration: durationTrim(m.length),
        length: duration2Millisecond(m.length),
        vip: m.vipFlag == 1,
        remark: m.songId || '',
        type: musicType
      });
    });
  }
  playlist = await daily();
  return {
    total,
    list,
    playlist
  };
}

export async function digitalDetail(id: string) {
  var url =
    'https://m.music.migu.cn/migumusic/h5/digitalAlbum/info?pageSize=500&digitalAlbumId=' +
    id;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/playlist',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.data.detailInfo.id,
    name: ret.data.detailInfo.name,
    image: padProtocol(
      ret.data.detailInfo.mediumPic || ret.data.detailInfo.smallPic
    ),
    description: ret.data.detailInfo.intro,
    type: musicType
  };
  ret.data.songs.items.map((m: any) => {
    m.album = playlist;
    const music = parseMusic(m);
    music && list.push(music);
  });
  return {
    total: list.length,
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
  var url = `https://m.music.migu.cn/migumusic/h5/playlist/songsInfo?pageNo=${
    Math.floor(offset / 30) + 1
  }&pageSize=30&palylistId=${id}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/playlist',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  if (ret && ret.code == 999) {
    return digitalDetail(id);
  }
  const list: Music[] = [];
  const playlist = await playlistInfo(id);
  const total: number = playlist.total || ret.data.total;
  ret.data.items.map((m: any) => {
    const music = parseMusic(m);
    music && list.push(music);
  });
  return {
    total,
    list,
    playlist
  };
}

export async function albumDetail(id: string) {
  var url = 'https://m.music.migu.cn/migumusic/h5/album/info?albumId=' + id;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/music/album/playlist',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.data.detailInfo.id,
    name: ret.data.detailInfo.name,
    image: ret.data.detailInfo.mediumPic,
    description: ret.data.detailInfo.albumDesc,
    type: musicType
  };
  playlist.description = playlist.description?.replace(/\n+/g, '<br />');
  const total: number = ret.data.songs.items.length;
  ret.data.songs.items.map((m: any) => {
    const music = parseMusic(m);
    music && list.push(music);
  });
  return {
    total,
    list,
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
  var desc = `实时追踪当前平台飙升最快的单曲。关注发行时间超过30 天的音乐作品，发掘最值得循环的经典歌曲！<br />
歌曲数量：100首<br />
榜单规则：根据登录用户的【试听】、【下载】、【分享】、【收藏】等数据，对发行时间超过 30天的歌曲进行实时排名。`;
  switch (ranking) {
    case RankingType.New:
      id = RankingNew;
      name = '新歌榜';
      image = RankingNewImage;
      desc = `实时统计当前平台最具人气的热门新歌，关注发行时间在 30 天内的音乐作品，寻找最具人气的潮流单曲！<br />
歌曲数量：50首<br />
榜单规则：根据登录用户的【试听】、【下载】、【分享】、【收藏】等数据，对30天内发行的歌曲进行实时排名`;
      break;
    case RankingType.Soar:
      id = RankingSoar;
      name = '原创榜';
      image = RankingSoarImage;
      desc = `实时追踪当前平台最受听众喜爱的原创音乐作品，聚焦发行时间在90天内的原创作品，用行动鼓励原创！<br />
歌曲数量：50首<br />
榜单规则：根据登录用户的【试听】、【下载】、【分享】、【收藏】等数据，对90 天内发行的原创歌曲进行实时排名。`;
      break;
  }
  return {
    id,
    name: '咪咕音乐' + name,
    image,
    description: desc,
    type: musicType
  };
}

export async function ranking1(ranking: RankingType, offset: number) {
  var rankingId = '';
  switch (ranking) {
    case RankingType.New:
      rankingId = 'jianjiao_newsong';
      break;
    case RankingType.Soar:
      rankingId = 'jianjiao_original';
      break;

    default:
      rankingId = 'jianjiao_hotsong';
      break;
  }
  var res = await httpProxy({
    url: `https://m.music.migu.cn/migumusic/h5/billboard/home?pathName=${rankingId}&pageNum=${
      1 + Math.round(offset / 30)
    }&pageSize=30`,
    method: 'GET',
    headers: {
      By: 'd567433192b439b47c5ea87e55bcc282',
      Referer: 'https://m.music.migu.cn/v4/music/top/' + rankingId,
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.data.songs.itemTotal;
  ret.data.songs.items.map((m: any) => {
    const music = parseMusic(m);
    music && list.push(music);
  });
  return {
    total,
    list
  };
}

export async function ranking(ranking: RankingType, _offset: number) {
  var rankingId = '';
  switch (ranking) {
    case RankingType.New:
      rankingId = '27553319';
      break;
    case RankingType.Soar:
      rankingId = '27553408';
      break;

    default:
      rankingId = '27186466';
      break;
  }
  var res = await httpProxy({
    url:
      'https://app.c.nf.migu.cn/MIGUM3.0/column/rank/h5/v1.0?&pageSize=30&columnId=' +
      rankingId,
    method: 'GET'
  });
  const ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.data.columnInfo.contents.length;
  ret.data.columnInfo.contents.map((item: any) => {
    const m = item.objectInfo;
    const music = parseMusic(m);
    music && list.push(music);
  });
  return {
    total,
    list
  };
}

async function listenUrl(music: Music, quality: MusicQuality = 'PQ') {
  var url =
    'https://c.musicapp.migu.cn/MIGUM3.0/strategy/listen-url/v2.4?' +
    'resourceType=2&netType=01&scene=' +
    `&toneFlag=${quality || 'PQ'}` +
    `&contentId=${music.remark}` +
    `&copyrightId=${music.id}` +
    `&lowerQualityContentId=${music.id}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      channel: '014000D',
      Cookie: miguCookie,
      uid: miguUid
    }
  });
  let ret = await res.json();
  if (ret && ret.data && ret.data.url && ret.data.song) {
    let image = ret.data.song.img2 || ret.data.song.img1;
    if (image && image.startsWith('/prod'))
      image = 'https://d.musicapp.migu.cn' + image;
    return {
      url: ret.data.url.replace('http://', 'https://') as string,
      lyricUrl: (ret.data.lrcUrl || '') as string,
      duration: second2Duration(ret.data.song.duration),
      length: 1000 * ret.data.song.duration,
      image
    };
  }
  return null;
}

export async function downloadUrl(music: Music): Promise<string> {
  let data = await listenUrl(music, downloadQuality);
  if (data && data.url) return data.url;
  return '';
}

export async function musicDetail(music: Music): Promise<Music> {
  let data = await listenUrl(music, playQuality);
  if (data) {
    music.url = data.url;
    music.lyricUrl = data.lyricUrl || '';
    music.duration = data.duration;
    music.length = data.length;
    if (!music.image) {
      music.image = data.image;
    }
  }
  return music;
}

export async function singerSongs(id: string) {
  var url =
    'https://m.music.migu.cn/migumusic/h5/singer/getSingerSAM?pageNo=1&pageSize=30&sam=100&singerId=' +
    id;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/music/album/playlist',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  return ret;
}

export async function lyric(music: Music): Promise<string> {
  if (!music.lyricUrl) {
    await musicDetail(music);
  }
  if (!music.lyricUrl) return '';
  const res = await fetch(parseHttpProxyAddress(music.lyricUrl));
  return await res.text();
}

export async function musicById(id: string): Promise<Music | null> {
  var url =
    'https://c.musicapp.migu.cn/MIGUM3.0/resource/song/by-contentids/v2.0?contentId=' +
    id;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      channel: '014000D'
    }
  });
  let ret = await res.json();
  if (ret && ret.data && ret.data[0]) {
    const m = ret.data[0];
    return parseMusic(m);
  }
  return null;
}

export async function parseLink(link: string) {
  const matchMiguShare = /c.migu.cn\/[a-zA-Z\d]+/.test(link);
  if (matchMiguShare) {
    const res = await httpProxy({
      url: link,
      method: 'GET',
      allowAutoRedirect: false
    });
    const data = await res.json();
    const redirectLocation = (data && data.Location) || '';
    if (redirectLocation) {
      const matchMiguId =
        /migu\.cn[\S]+(song|playlist)[\S]*[\?&]id=([\d]+)/.exec(
          redirectLocation
        );
      if (matchMiguId) {
        return {
          linkType: matchMiguId[1] == 'playlist' ? 'playlist' : 'music',
          id: matchMiguId[2]
        };
      }
    }
  }
  return null;
}

export async function qrCodeKey(): Promise<{
  key: string;
  url?: string;
}> {
  var res = await httpProxy({
    url: 'https://passport.migu.cn/api/qrcWeb/qrcLogin?sourceID=220001',
    method: 'POST',
    data: 'isAsync=true&sourceid=220001',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  });
  const ret = await res.json();
  return {
    key: ret.result.qrc_sessionid,
    url: ret.result.qrcUrl
  };
}

export async function loginStatus(key: string): Promise<{
  status: LoginStatus;
  user?: UserInfo;
}> {
  let res = await httpProxy({
    url: 'https://passport.migu.cn/api/qrcWeb/qrcquery',
    method: 'POST',
    data: 'isAsync=true&sourceid=220001&qrc_sessionid=' + key,
    setCookieRename: true,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  });
  let ret = await res.json();
  if (ret && ret.status == 2000 && ret.result && ret.result.token) {
    const lastCookie = parseCookie(res.headers.get('Set-Cookie-Renamed') || '');
    res = await httpProxy({
      url: ret.result.redirectURL + '?token=' + ret.result.token,
      method: 'GET',
      setCookieRename: true,
      headers: {
        Cookie: res.headers.get('Set-Cookie-Renamed') || ''
      }
    });
    if (res.ok) {
      const cookie = formatCookies({
        ...lastCookie,
        ...parseCookie(res.headers.get('Set-Cookie-Renamed') || '')
      });
      const user = await userInfo(cookie);
      if (user && user.id) {
        user.cookie = cookie;
        return {
          status: 'success',
          user
        };
      }
    }
  } else if (ret && ret.status == 4074) {
    return { status: 'waiting' };
  }
  return {
    status: 'fail'
  };
}

export async function userInfo(cookies: string): Promise<UserInfo | null> {
  miguCookie = cookies;
  var res = await httpProxy({
    url: 'https://music.migu.cn/v3/api/user/getUserInfo',
    method: 'GET',
    headers: {
      Referer: 'https://music.migu.cn/v3/my/collect',
      Cookie: formatCookies(cookies)
    }
  });
  const ret = await res.json();
  if (!ret || !ret.user || !ret.user.uid) return null;
  miguUid = ret.user.uid;
  localStorage.setItem('musiche-migu-uid', miguUid);
  return {
    id: miguUid,
    name: ret.user.nickname,
    image: ret.user.avatar.smallAvatar
  };
}
