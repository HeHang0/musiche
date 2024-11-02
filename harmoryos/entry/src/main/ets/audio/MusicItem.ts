import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { buffer } from '@kit.ArkTS';
import { MusicType } from './MusicType';
import { Quality } from './Quality';
import { aesEncrypt, httpRequest, jsonParse } from '../utils/utils';
import { hilog } from '@kit.PerformanceAnalysisKit';

export class MusicItem {
  private static readonly encSecKey = "&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053";
  private static readonly userAgent = "Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1";

  public id: string = "";
  public name: string = "";
  public image: string = "";
  public largeImage: string = "";
  public mediumImage: string = "";
  public singer: string = "";
  public duration: string = "";
  public album: string = "";
  public remark: string = "";
  public cookie: string|Record<string, string> = "";
  public musicU: string = "";
  public uid: string = "";
  public csrf: string = "";
  public type: string = "";
  public lover: boolean = false;
  constructor(data: Record<string, any>) {
    Object.assign(this, data)
    this.parseCookie()
  }

  private parseCookie(){
    const cookieJson = typeof this.cookie === 'string' ? jsonParse(this.cookie) : this.cookie;
    if(this.type === MusicType.Cloud) {
      this.csrf = `${cookieJson['__csrf']}`
      this.musicU = `${cookieJson['MUSIC_U']}`
    }else if(this.type === MusicType.Cloud) {
      this.cookie = `${cookieJson['cookie']}`
      this.uid = `${cookieJson['uid']}`
    }
  }

  getMusicUrl(quality: Quality): Promise<string>{
    try{
      switch (this.type) {
        case "cloud": return this.getCloudMusicUrl(quality);
        case "qq": return this.getQQMusicUrl(quality, false);
        case "migu": return this.getMiGuMusicUrl(quality);
        default: return Promise.resolve('');
      }
    } catch (e) {
      hilog.error(0x0000, MusicItem.name, 'music item url err: ' + JSON.stringify(e));
      return Promise.resolve('');
    }
  }

  private async getCloudMusicUrl(quality: Quality): Promise<string>{
    let br = 128000
    switch(quality){
      case Quality.HQ: br = 320000; break;
      case Quality.SQ: br = 480000; break;
      case Quality.ZQ: br = 960000; break;
    }
    const data = {
      "ids": [this.id],
      "br": br,
      "csrf_token": this.csrf
    };
    let param = await aesEncrypt(JSON.stringify(data), "0CoJUm6Qyw8W8jud");
    param = await aesEncrypt(param, "t9Y0m4pdsoMznMlL");
    param = encodeURIComponent(param);
    param = 'params=' + param + MusicItem.encSecKey;
    const response = await httpRequest('https://music.163.com/weapi/song/enhance/player/url?csrf_token=', 'POST', {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://music.163.com",
      "User-Agent": MusicItem.userAgent,
      "Cookie": "os=ios;MUSIC_U=" + (this.musicU || '')
    }, param)
    const result = jsonParse(response)
    try{
      return result["data"][0]["url"].replace("http://", "https://");
    }catch(e){
      return ''
    }
  }

  private async getQQMusicUrl(quality: Quality, audition: boolean): Promise<string>{
    const timestampInSeconds = Math.floor(new Date().valueOf() / 1000);
    const data = JSON.stringify({
      "comm": {
        "cv": 4747474,
        "ct": 24,
        "format": 'json',
        "inCharset": 'utf-8',
        "outCharset": 'utf-8',
        "notice": 0,
        "platform": 'yqq.json',
        "needNewCode": 1
      },
      "req_0": {
        "module": 'vkey.GetVkeyServer',
        "method": 'CgiGetVkey',
        "param": {
          "guid": timestampInSeconds,
          "songmid": [this.id],
          "songtype": [0],
          "uin": '',
          "loginflag": 1,
          "platform": '20',
          "filename": audition && this.remark ? [this.remark] : []
        }
      }
    })
    const response = await httpRequest('https://u.y.qq.com/cgi-bin/musicu.fcg', 'POST', {
      "Referer": "https://y.qq.com",
      "Content-Type": "application/json",
      "User-Agent": MusicItem.userAgent,
      "Cookie": `${this.cookie}`
    }, data)
    const result = jsonParse(response)
    try{
      const data = result["req_0"]["data"];
      const pUrl = data["midurlinfo"][0]["purl"];
      if(pUrl) {
        const sip: string = data["sip"];
        let urlPrefix = "https://dl.stream.qqmusic.qq.com/";
        for(let i=0;i<sip.length;i++){
          if(sip[i]){
            urlPrefix = sip[i];
            break;
          }
        }
        return urlPrefix+pUrl;
      }
    }catch(e){
    }
    if(!audition) {
      return this.getQQMusicUrl(quality, true);
    }
    return "";
  }

  private async getMiGuMusicUrl(quality: Quality): Promise<string>{
    const requestUrl = "https://c.musicapp.migu.cn/MIGUM3.0/strategy" +
    "/listen-url/v2.4?resourceType=2&netType=01&" +
    `scene=&toneFlag=${quality}&contentId=${this.remark}&` +
    `copyrightId=${this.id}&lowerQualityContentId=${this.id}`;
    const response = await httpRequest(requestUrl, 'GET', {
      "channel": "014000D",
      "uid": this.uid,
      "Cookie": `${this.cookie}`
    });
    const result = jsonParse(response)
    try{
      return result["data"]["url"].replace("http://", "https://")
    }catch(e){
      return ''
    }
  }
}