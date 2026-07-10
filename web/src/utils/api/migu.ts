import { httpProxy as httpProxyOrigin, parseHttpProxyAddress } from '../http';
import {
  LoginStatus,
  Music,
  MusicQuality,
  MusicType,
  Playlist,
  PlaylistSearchItem,
  ProxyRequestData,
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
  parseCookieText,
  second2Duration
} from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-original.jpg';

const musicType: MusicType = 'migu';

var miguCookie: string = '';

var miguUid: string = localStorage.getItem('musiche-migu-uid') || '';

var miguName: string = localStorage.getItem('musiche-migu-name') || '';

var onCookieChanged:
  | ((cookie: string | Record<string, string>) => void)
  | null = null;

export async function subscribeCookieChanged(
  func: (cookie: string | Record<string, string>) => void
) {
  onCookieChanged = func;
}

async function httpProxy(prd: ProxyRequestData): Promise<Response> {
  prd.setCookieRename = true;
  const res = await httpProxyOrigin(prd);
  const newCookieText = res.headers.get('Set-Cookie-Renamed') || '';
  if (newCookieText) {
    const newCookie =
      parseCookie(res.headers.get('Set-Cookie-Renamed') || '') || {};
    const oldCookieObj = parseCookieText(miguCookie);
    miguCookie = formatCookies({
      ...oldCookieObj,
      ...newCookie
    });
    onCookieChanged && onCookieChanged(miguCookie);
  }
  return Promise.resolve(res);
}

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

function parseImage3(data: any) {
  if (!data) return { image: '', mediumImage: '', largeImage: '' };
  const imgPrefix = 'https://d.musicapp.migu.cn';
  let smallImage =
    data.img1 ||
    data.albumImgs?.find((m: any) => m.imgSizeType === '01')?.img ||
    '';
  let mediumImage =
    data.img2 ||
    data.albumImgs?.find((m: any) => m.imgSizeType === '02')?.img ||
    '';
  let largeImage =
    data.img3 ||
    data.albumImgs?.find((m: any) => m.imgSizeType === '03')?.img ||
    '';
  if (smallImage && !smallImage.startsWith('http')) {
    smallImage = imgPrefix + smallImage;
  }
  if (mediumImage && !mediumImage.startsWith('http')) {
    mediumImage = imgPrefix + mediumImage;
  }
  if (largeImage && !largeImage.startsWith('http')) {
    largeImage = imgPrefix + largeImage;
  }
  return {
    image: smallImage,
    mediumImage: mediumImage,
    largeImage: largeImage
  };
}

function parseMusic3(data: any): Music | null {
  if (!data) return null;
  return {
    id: data.copyrightId,
    name: data.name || data.songName,
    ...parseImage3(data),
    singer: parseSinger(data.singerList),
    album: data.album || '',
    albumId: data.albumId || '',
    duration: second2Duration(data.duration || 0),
    length: data.duration || 0,
    vip: data.downloadTags?.includes('vip') || false,
    remark: data.contentId || data.songId,
    type: musicType
  };
}

function parsePlaylistSearchItem(data: any): PlaylistSearchItem | null {
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    image: data.musicListPicUrl,
    type: musicType,
    trackCount: Number(data.musicNum || 0),
    playCount: Number(data.playNum || 0),
    bookCount: Number(data.keepNum || 0),
    creator: '',
    creatorId: '',
    description: ''
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
  const query = `?text=${encodeURIComponent(keywords).replace(
    /%20/g,
    '+'
  )}&pageNo=${Math.round(offset / 30) + 1}&pageSize=30`;
  var url = `https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0${query}`;
  var urlTotal = `https://app.u.nf.migu.cn/pc/bmw/album/search/v1.0${query}`;
  const requestParams = {
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://music.migu.cn/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  };
  const [res, resTotal] = await Promise.all([
    httpProxy({ url, ...requestParams }),
    httpProxy({ url: urlTotal, ...requestParams })
  ]);
  const ret = await res.json();
  const retTotal = await resTotal.json();
  console.log('search', ret, retTotal);
  const list: Music[] = [];
  const total: number = Number(retTotal.data?.result?.totalCount || 0);
  ret?.map((m: any) => {
    const music = parseMusic3(m);
    music && list.push(music);
  });
  highlightKeys(list, keywords);
  return {
    total,
    list
  };
}

export async function searchPlaylist(
  keywords: string,
  offset: number = 0,
  limit: number = 30
): Promise<{
  total: number;
  list: PlaylistSearchItem[];
}> {
  const query = `?text=${encodeURIComponent(keywords).replace(
    /%20/g,
    '+'
  )}&pageNo=${Math.round(offset / limit) + 1}&pageSize=${limit}&searchSwitch={"songlist":+1}`;
  var url = `https://app.u.nf.migu.cn/pc/v1.0/content/search_all.do${query}`;
  const requestParams = {
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://music.migu.cn/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  };
  const res = await httpProxy({ url, ...requestParams });
  const ret = await res.json();
  const list: PlaylistSearchItem[] = [];
  const total: number = ret.songListResultData?.totalCount || 0;
  ret.songListResultData?.result.forEach((m: any) => {
    const playlist = parsePlaylistSearchItem(m);
    playlist && list.push(playlist);
  });
  highlightKeys(list, keywords);
  return {
    total,
    list
  };
}

export async function daily(): Promise<Playlist> {
  var res = await httpProxy({
    url: 'https://app.c.nf.migu.cn/pc/v1.0/template/todayRecommendList/release?actionId=1&index=1&templateVersion=5&signal=%7B%7D',
    method: 'GET',
    headers: {
      Cookie: miguCookie
    }
  });
  const ret = await res.json();
  let img = ret?.data?.recommendData?.img;
  if (img) {
    img = 'https://d.musicapp.migu.cn' + img;
  } else {
    img = 'https://d.musicapp.migu.cn/data/oss/service66/00/2b/0z/4i';
  }
  const musicList: Music[] = [];
  ret?.data?.recommendData?.data?.map((m: any) => {
    const music = parseMusic3(m);
    music && musicList.push(music);
  });
  return {
    id: 'daily',
    name: '今日推荐',
    image: img,
    description: `~嘿，${miguName}，咪咕发现这些歌超适合今日的你`,
    type: musicType,
    musicList
  };
}

export async function yours(_offset: number): Promise<{
  total: number;
  list: Playlist[];
}> {
  const list: Playlist[] = [];
  var res = await httpProxy({
    url: 'https://app.c.nf.migu.cn/pc/user/home-page/v2.0',
    method: 'GET',
    headers: {
      Cookie: miguCookie
    }
  });
  const ret = await res.json();
  ret.data?.userPrivateItems?.map((m: any) => {
    m.actionUrl.includes('musicListId=') &&
      list.push({
        id: m.actionUrl.substr(49),
        name: m.title,
        image: m.picUrl,
        type: musicType
      });
  });
  ret.data?.myCollectedMusicLists?.collectMusicLists?.map((m: any) => {
    m.resourceType === '2021' &&
      list.push({
        id: m.musicListId,
        name: m.title,
        image: m.imgItem.img,
        type: musicType
      });
  });
  ret.data?.myCreatedMusicLists?.createdMusicLists?.map((m: any) => {
    list.push({
      id: m.musicListId,
      name: m.title,
      image: m.imgItem.img,
      type: musicType
    });
  });

  const dailyPlaylist = await daily();
  if (dailyPlaylist) list.unshift(dailyPlaylist);

  return {
    total: list.length,
    list
  };
}

export async function recommend1(offset: number) {
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

export async function recommend(_offset: number) {
  var url = `https://app.c.nf.migu.cn/pc/bmw/page-data/playlist-square-recommend/v1.0?templateVersion=2&_t=${Date.now()}`;
  const e = URL.createObjectURL(new Blob());
  const t = e.toString();
  URL.revokeObjectURL(e);
  const miguCookieId = t.substring(t.lastIndexOf('/') + 1);
  var res = await httpProxy({
    url: url,
    method: 'GET',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/music/playlist',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      Cookie: 'migu_cookie_id' + '=' + miguCookieId,
      appid: 'h5'
    }
  });
  const ret = await res.json();
  const list: Playlist[] = [];
  const getItem = (m: any) => {
    if (m.title !== '标题' && m.resType === '2021') {
      return {
        id: m.resId,
        name: m.txt,
        image: m.img,
        type: musicType
      };
    }
    return null;
  };
  ret.data.contents?.map((o: any) => {
    const oItem = getItem(o);
    oItem && list.push(oItem);
    o.contents?.map((n: any) => {
      const nItem = getItem(n);
      nItem && list.push(nItem);
      n.contents?.map((m: any) => {
        const mItem = getItem(m);
        mItem && list.push(mItem);
      });
    });
  });
  const total: number = list.length;
  return {
    total,
    list
  };
}

export async function playlistInfo(id: string) {
  var url = 'https://app.c.nf.migu.cn/resource/playlist/v2.0?playlistId=' + id;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/playlist',
      appid: 'h5',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  let total = ret.data.musicNum || 0;
  return {
    id: ret.data.musicListId,
    name: ret.data.title,
    description: ret.data.summary && ret.data.summary.replace(/\n+/g, '<br />'),
    image: ret.data.imgItem.img,
    total: total,
    type: musicType
  };
}

export async function dailyPlayList(_offset: number) {
  const playlist = await daily();
  return {
    total: playlist?.musicList?.length || 0,
    list: playlist?.musicList || [],
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
  var url = `https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0?pageNo=${Math.floor(offset / 30) + 1}&pageSize=30&playlistId=${id}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://m.music.migu.cn/v4/playlist',
      appid: 'h5',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  let ret = await res.json();
  const list: Music[] = [];
  const playlist = await playlistInfo(id);
  const total: number = ret.data.totalCount;
  ret.data.songList.map((m: any) => {
    const music = parseMusic3(m);
    music && list.push(music);
  });
  return {
    total,
    list,
    playlist
  };
}

export async function albumDetail(id: string) {
  const url = 'https://app.c.nf.migu.cn/resource/album/v2.0?albumId=' + id;
  const res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      by: '22210ca73bf1af2ec2eace74a96ee356',
      Referer: 'https://music.migu.cn/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    }
  });
  const ret = await res.json();
  const list: Music[] = [];
  const playlist: Playlist = {
    id: ret.data.albumId,
    name: ret.data.title,
    image: ret.data.imgItems?.[1]?.img || ret.data.imgItems?.[0]?.img || '',
    description: ret.data.summary?.replace(/\n+/g, '<br />') || '',
    type: musicType
  };
  const total: number = Number(ret.data?.totalCount || 0);
  if (total > 0) {
    const urlSongs = `https://app.c.nf.migu.cn/MIGUM3.0/resource/album/song/v2.0?pageNo=1&pageSize=${total}&albumId=${id}`;
    const resSongs = await httpProxy({
      url: urlSongs,
      method: 'GET',
      data: '',
      headers: {
        by: '22210ca73bf1af2ec2eace74a96ee356',
        Referer: 'https://music.migu.cn/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
      }
    });
    const retSongs = await resSongs.json();
    retSongs.data.songList.map((m: any) => {
      const music = parseMusic3(m);
      music && list.push(music);
    });
  }
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
    const music = parseMusic3(m);
    music && list.push(music);
  });
  return {
    total,
    list
  };
}

async function listenUrl(music: Music, quality: MusicQuality = 'PQ') {
  var url = `https://app.c.nf.migu.cn/strategy/pc/listen/v2.0?contentId=${music.remark}&copyrightId=${music.id}&scene=&netType=01&resourceType=2&toneFlag=${quality || 'PQ'}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      channel: '014X031',
      cookie: miguCookie,
      uid: miguUid,
      appid: 'h5',
      birth: 'h5page',
      signature: '1',
      referer: 'https://music.migu.cn/'
    }
  });
  const a = 'Jk8qzuePiJ1qE3mDYhLQ3T73DtDoAhLP';

  function eF(e: Uint8Array, r: string): Uint8Array {
    if (r.length == 0) return new Uint8Array();
    var n = e.length;
    for (
      var t = e[3],
        a = new TextEncoder().encode(r),
        i = a.length,
        o = new Uint8Array(n - 4),
        s = 0,
        c = 4;
      c < n;
      c++, s++
    )
      o[s] = e[c] + t - a[s % i];
    return o;
  }

  let retArray = await res.arrayBuffer();
  const text = new TextDecoder().decode(eF(new Uint8Array(retArray), a));
  if (!text) return null;
  const ret = JSON.parse(text);
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
  } else if (ret && ret.data?.cannotCode === '440018') {
    switch (quality) {
      case 'PQ':
        return await listenUrl(music, 'SQ');
      case 'SQ':
        return await listenUrl(music, 'HQ');
      case 'HQ':
        return await listenUrl(music, 'ZQ');
    }
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
    const redirectLocation = (data && (data.Location || data.location)) || '';
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
      allowAutoRedirect: false,
      headers: {
        Cookie: formatCookies(lastCookie)
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
    url: 'https://app.c.nf.migu.cn/pc/user/h5/queryUserInfo/v1.0',
    method: 'GET',
    headers: {
      Cookie: formatCookies(cookies)
    }
  });
  const ret = await res.json();
  if (!ret || !ret.userInfoItem || !ret.userInfoItem.userId) return null;
  miguUid = ret.userInfoItem.userId;
  miguName = ret.userInfoItem.nickName;
  localStorage.setItem('musiche-migu-uid', miguUid);
  localStorage.setItem('musiche-migu-name', miguName);
  return {
    id: miguUid,
    name: miguName,
    image: ret.userInfoItem.smallIcon
  };
}
