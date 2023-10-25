import { httpProxy, parseHttpProxyAddress } from '../http';
import { Music, MusicType, Playlist, RankingType } from '../type';
import { duration2Millisecond, durationTrim, second2Duration } from '../utils';
import RankingHotImage from '../../assets/images/ranking-hot.jpg';
import RankingNewImage from '../../assets/images/ranking-new.jpg';
import RankingSoarImage from '../../assets/images/ranking-original.jpg';

function padProtocol(url: string) {
  return url && url.startsWith('//') ? 'https:' + url : url;
}

export async function search(keywords: string, offset: number) {
  var url = `https://m.music.migu.cn/migumusic/h5/search/all?text=${encodeURIComponent(
    keywords
  )}&pageNo=${offset + 1}&pageSize=30`;
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
  if (ret && ret.data && ret.data.url) {
    music.url = ret.data.url.replace('http://', 'https://');
    music.lyricUrl = ret.data.lrcUrl || '';
    music.duration = second2Duration(ret.data.song.duration);
    music.length = 1000 * ret.data.song.duration;
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
