import { httpProxy, parseHttpProxyAddress } from '../http';
import {
  LoginStatus,
  Music,
  MusicType,
  Playlist,
  RankingType,
  UserInfo
} from '../type';
import {
  duration2Millisecond,
  durationTrim,
  formatCookies,
  parseCookie,
  second2Duration
} from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-original.jpg';

function padProtocol(url: string) {
  return url && url.startsWith('//') ? 'https:' + url : url;
}

export async function search(keywords: string, offset: number) {
  var url = `https://m.music.migu.cn/migumusic/h5/search/all?text=${encodeURIComponent(
    keywords
  ).replace(/%20/g, '+')}&pageNo=${offset + 1}&pageSize=30`;
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
    list.push({
      id: m.copyrightId,
      name: m.name,
      image: padProtocol(m.mediumPic),
      singer: Array.isArray(m.singers)
        ? m.singers.map((n: any) => n.name).join(' / ')
        : '',
      album: (m.album && m.album.name) || '',
      albumId: (m.album && m.album.id) || '',
      duration: '',
      vip: (m.vipFlag || (m.fullSong && m.fullSong.vipFlag)) == 1,
      remark: m.fullSong.productId,
      type: MusicType.MiguMusic
    });
  });
  return {
    total,
    list
  };
}

export async function daily(cookies: string): Promise<Playlist | null> {
  const user = await userInfo(cookies);
  return {
    id: 'daily',
    name: '你会喜欢',
    image: (user && user.image) || '',
    type: MusicType.MiguMusic
  };
}

export async function yours(
  cookies: string,
  _offset: number
): Promise<{
  total: number;
  list: Playlist[];
}> {
  const list: Playlist[] = [];
  const dailyPlaylist = await daily(cookies);
  if (dailyPlaylist) list.push(dailyPlaylist);

  const cookie = formatCookies(cookies);
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
        Cookie: cookie
      }
    });
    const ret = await res.json();
    var retList = ret.playLists || ret.data.items || ret.data;
    retList.map((m: any) => {
      let image = m.playListPic || m.image || m.picUrl;
      if (image.startsWith('//')) image = 'https://' + image;
      list.push({
        id: m.id || m.playListId,
        name: m.playListName || m.name,
        image: image,
        type: MusicType.MiguMusic
      });
    });
  }

  return {
    total: 1,
    list
  };
}

export async function recommend(offset: number) {
  var url = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/template/musiclistplaza-listbytag/release?pageNumber=${
    offset + 1
  }&tagId=1003449976`;
  var res = await httpProxy({
    url: url,
    method: 'GET'
  });
  const ret = await res.json();
  const list: Playlist[] = [];
  const total: number = ret.data.contentItemList.itemList.length;
  ret.data.contentItemList.itemList.map((m: any) => {
    list.push({
      id: m.logEvent.contentId,
      name: m.title,
      image: m.imageUrl.replace('http://', 'https://'),
      type: MusicType.MiguMusic
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
  return {
    id: ret.data.playListId,
    name: ret.data.playListName,
    description: ret.data.summary && ret.data.summary.replace(/\n+/g, '<br />'),
    image: padProtocol(ret.data.image),
    type: MusicType.MiguMusic
  };
}

export async function dailyPlayList(cookies: string) {
  const headers: Record<string, string> = {
    Referer: 'https://music.migu.cn/v3',
    Cookie: formatCookies(cookies)
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
        type: MusicType.MiguMusic
      });
    });
  }
  playlist = await daily(cookies);
  return {
    total,
    list,
    playlist
  };
}

export async function digitalDetail(id: string, _cookies?: string) {
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
    type: MusicType.MiguMusic
  };
  ret.data.songs.items.map((m: any) => {
    list.push({
      id: m.copyrightId,
      name: m.name,
      image: padProtocol(m.smallPic || m.mediumPic),
      singer: Array.isArray(m.singers)
        ? m.singers.map((n: any) => n.name).join(' / ')
        : '',
      album: playlist.name,
      albumId: playlist.id,
      duration: durationTrim(m.length),
      length: duration2Millisecond(m.length),
      vip: (m.vipFlag || (m.fullSong && m.fullSong.vipFlag)) == 1,
      remark: (m.fullSong && m.fullSong.productId) || '',
      type: MusicType.MiguMusic
    });
  });
  return {
    total: list.length,
    list,
    playlist
  };
}

export async function playlistDetail(id: string, cookies?: string) {
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
  var url =
    'https://m.music.migu.cn/migumusic/h5/playlist/songsInfo?pageNo=1&pageSize=30&palylistId=' +
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
  let ret = await res.json();
  if (ret && ret.code == 999) {
    return digitalDetail(id, cookies);
  }
  const list: Music[] = [];
  const playlist = await playlistInfo(id);
  const total: number = ret.data.total;
  ret.data.items.map((m: any) => {
    list.push({
      id: m.copyrightId,
      name: m.name,
      image: padProtocol(m.mediumPic),
      singer: Array.isArray(m.singers)
        ? m.singers.map((n: any) => n.name).join(' / ')
        : '',
      album: (m.album && m.album.albumName) || '',
      albumId: (m.album && m.album.albumId) || '',
      duration: durationTrim(m.duration),
      length: duration2Millisecond(m.duration),
      vip: (m.vipFlag || (m.fullSong && m.fullSong.vipFlag)) == 1,
      remark: (m.fullSong && m.fullSong.productId) || '',
      type: MusicType.MiguMusic
    });
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
    type: MusicType.MiguMusic
  };
  playlist.description = playlist.description?.replace(/\n+/g, '<br />');
  const total: number = ret.data.songs.items.length;
  ret.data.songs.items.map((m: any) => {
    list.push({
      id: m.copyrightId,
      name: m.name,
      image: padProtocol(m.mediumPic),
      singer: Array.isArray(m.singers)
        ? m.singers.map((n: any) => n.name).join(' / ')
        : '',
      album: (m.album && m.album.albumName) || '',
      albumId: (m.album && m.album.albumId) || '',
      duration: durationTrim(m.duration),
      length: duration2Millisecond(m.duration),
      vip: (m.vipFlag || (m.fullSong && m.fullSong.vipFlag)) == 1,
      remark: (m.fullSong && m.fullSong.productId) || '',
      type: MusicType.MiguMusic
    });
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
    type: MusicType.MiguMusic
  };
}

export async function ranking(ranking: RankingType) {
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
      'https://app.c.nf.migu.cn/MIGUM3.0/column/rank/h5/v1.0?columnId=' +
      rankingId,
    method: 'GET'
  });
  const ret = await res.json();
  const list: Music[] = [];
  const total: number = ret.data.columnInfo.contents.length;
  ret.data.columnInfo.contents.map((item: any) => {
    const m = item.objectInfo;
    list.push({
      id: m.copyrightId,
      name: m.songName,
      image: m.albumImgs[m.albumImgs.length - 1]['img'],
      singer: Array.isArray(m.artists)
        ? m.artists.map((n: any) => n.name).join(' / ')
        : '',
      album: m.album,
      albumId: m.albumId,
      duration: durationTrim(m.length),
      length: duration2Millisecond(m.length),
      vip: (m.vipFlag || (m.fullSong && m.fullSong.vipFlag)) == 1,
      remark: m.contentId,
      type: MusicType.MiguMusic
    });
  });
  return {
    total,
    list
  };
}

export async function musicDetail(music: Music) {
  var url =
    'https://c.musicapp.migu.cn/MIGUM3.0/strategy/listen-url/v2.4?' +
    'resourceType=2&netType=01&toneFlag=PQ&scene=' +
    `&contentId=${music.remark}` +
    `&copyrightId=${music.id}` +
    `&lowerQualityContentId=${music.id}`;
  var res = await httpProxy({
    url: url,
    method: 'GET',
    data: '',
    headers: {
      channel: '014000D'
    }
  });
  let ret = await res.json();
  if (ret && ret.data && ret.data.url && ret.data.song) {
    music.url = ret.data.url.replace('http://', 'https://');
    music.lyricUrl = ret.data.lrcUrl || '';
    music.duration = second2Duration(ret.data.song.duration);
    music.length = 1000 * ret.data.song.duration;
    if (!music.image) {
      let image = ret.data.song.img2 || ret.data.song.img1;
      if (image && image.startsWith('/prod'))
        image = 'https://d.musicapp.migu.cn' + image;
      music.image = image;
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
  console.log('singer songs', ret);
  return null;
}

export async function lyric(music: Music) {
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
    return {
      id: m.copyrightId,
      name: m.songName,
      image: m.img1 || m.img2 || m.img3,
      singer: Array.isArray(m.singerList)
        ? m.singerList.map((n: any) => n.name).join(' / ')
        : '',
      album: m.album,
      albumId: m.albumId,
      duration: second2Duration(m.duration),
      length: m.duration * 1000,
      vip: m.downloadTags && m.downloadTags.includes('vip'),
      remark: m.contentId,
      type: MusicType.MiguMusic
    };
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
  return {
    id: ret.user.uid,
    name: ret.user.nickname,
    image: ret.user.avatar.smallAvatar
  };
}
