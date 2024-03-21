import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:encrypt/encrypt.dart';

import '../log/logger.dart';

enum Quality {
  pq, sq, hq, zq
}
class MusicItem {
  static const String _tag = "MusicItem";
  static const String _encSecKey = "&encSecKey=409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053";
  static const String _cloudMusicAPI = "https://music.163.com/weapi/song/enhance/player/url?csrf_token=";
  static const String _userAgent = "Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1";
  String id = "";
  String name = "";
  String image = "";
  String singer = "";
  String album = "";
  String remark = "";
  String cookie = "";
  String musicU = "";
  String uid = "";
  String csrf = "";
  String type = "";
  bool lover = false;
  MusicItem();

  Future<String> getMusicUrl(Quality quality){
    switch(type){
      case "cloud": return _getCloudMusicUrl(quality);
      case "qq": return _getQQMusicUrl(quality, false);
      case "migu": return _getMiGuMusicUrl(quality);
      default: return Future(() => "");
    }
  }

  Future<String> _getCloudMusicUrl(Quality quality) async {
    int br;
    switch(quality){
      case Quality.hq: br = 320000; break;
      case Quality.sq: br = 480000; break;
      case Quality.zq: br = 960000; break;
      default: br = 128000; break;
    }
    Map<String, dynamic> data = {
      "ids": [id],
      "br": br,
      "csrf_token": csrf
    };
    String param = aesEncrypt(jsonEncode(data), "0CoJUm6Qyw8W8jud");
    param = aesEncrypt(param, "t9Y0m4pdsoMznMlL");
    param = Uri.encodeComponent(param);
    String paramData = "params=$param$_encSecKey";
    final response = await http.post(Uri.parse(_cloudMusicAPI), headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://music.163.com",
      "User-Agent": _userAgent,
      "Cookie": "os=ios;MUSIC_U=$musicU"
    }, body: paramData);
    try{
      Map<String, dynamic> result = jsonDecode(response.body);
      String musicUrl = result["data"][0]["url"];
      if(musicUrl.isNotEmpty) return musicUrl.replaceFirst("http://", "https://");
    }catch(e){
      Logger.e(_tag, "request cloud url error", error: e);
    }
    return "";
  }

  Future<String> _getQQMusicUrl(Quality quality, bool audition) async {
    int timestampInSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    String data = jsonEncode({
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
          "songmid": [id],
          "songtype": [0],
          "uin": '',
          "loginflag": 1,
          "platform": '20',
          "filename": audition && remark.isNotEmpty ? [remark] : []
        }
      }
    });
    final response = await http.post(Uri.parse(_cloudMusicAPI), headers: {
      "Content-Type": "application/json",
      "Referer": "https://y.qq.com",
      "User-Agent": _userAgent,
      "Cookie": cookie
    }, body: data);
    try{
      dynamic result = jsonDecode(response.body);
      dynamic data = result["req_0"]["data"];
      String pUrl = data["midurlinfo"][0]["purl"];
      List<String> sip = data["sip"];
      String urlPrefix = "https://dl.stream.qqmusic.qq.com/";
      for(int i=0;i<sip.length;i++){
        if(sip[i].isNotEmpty){
          urlPrefix = sip[i];
          break;
        }
      }
      if(pUrl.isNotEmpty) return urlPrefix+pUrl;
    }catch(e){
      Logger.e(_tag, "request qq url error", error: e);
    }
    if(!audition) return _getQQMusicUrl(quality, true);
    return "";
  }

  Future<String> _getMiGuMusicUrl(Quality quality) async {
    String toneFlag = quality.name.toUpperCase();
    String requestUrl = "https://c.musicapp.migu.cn/MIGUM3.0/strategy"
        "/listen-url/v2.4?resourceType=2&netType=01&"
        "scene=&toneFlag=$toneFlag&contentId=$remark&"
        "copyrightId=$id&lowerQualityContentId=$id";
    final response = await http.get(Uri.parse(requestUrl), headers: {
      "channel": "014000D",
      "uid": uid,
      "Cookie": cookie
    });
    try{
      dynamic result = jsonDecode(response.body);
      String musicUrl = result["data"]?["url"]?.toString() ?? "";
      if(musicUrl.isNotEmpty) return musicUrl.replaceFirst("http://", "https://");
    }catch(e){
      Logger.e(_tag, "request qq url error", error: e);
    }
    return "";
  }

  static String aesEncrypt(String plainText, String keyText){
    String ivText = "0102030405060708";
    if (plainText.isEmpty || keyText.isEmpty) return "";
    try {
      final key = Key.fromUtf8(keyText);
      final iv = IV.fromUtf8(ivText);
      final encrypter = Encrypter(AES(key, mode: AESMode.cbc));
      final encrypted = encrypter.encrypt(plainText, iv: iv);
      String base64Str = encrypted.base64;
      return base64Str.replaceAll("\n", "").replaceAll("\r", "");
    } catch (e) {
      Logger.e(_tag, "aes encrypt error: ${e.toString()}");
    }
    return "";
  }

  factory MusicItem.from(dynamic source){
    MusicItem result = MusicItem();
    Map<String, dynamic>? json;
    if(source is Map){
      json = source as Map<String, dynamic>;
    }
    if(json == null) return result;
    if(json.containsKey("id")){
      result.id = json["id"]?.toString() ?? "";
    }
    if(json.containsKey("name")){
      result.name = json["name"]?.toString() ?? "";
    }
    if(json.containsKey("largeImage")){
      result.image = json["largeImage"]?.toString() ?? "";
    }else if(json.containsKey("mediumImage")){
      result.image = json["mediumImage"]?.toString() ?? "";
    }else if(json.containsKey("image")){
      result.image = json["image"]?.toString() ?? "";
    }
    if(json.containsKey("singer")){
      result.singer = json["singer"]?.toString() ?? "";
    }
    if(json.containsKey("lover") && json["lover"].runtimeType == bool){
      result.lover = json["lover"];
    }
    if(json.containsKey("remark")){
      result.remark = json["remark"]?.toString() ?? "";
    }
    if(json.containsKey("type")){
      result.type = json["type"]?.toString().toLowerCase() ?? "";
    }
    if(json.containsKey("__csrf")){
      result.csrf = json["__csrf"]?.toString() ?? "";
    }
    if(json.containsKey("MUSIC_U")){
      result.musicU = json["MUSIC_U"]?.toString() ?? "";
    }
    if(json.containsKey("uid")){
      result.uid = json["uid"]?.toString() ?? "";
    }
    if(json.containsKey("cookie")){
      switch(result.type){
        case "cloud":
          if(json["cookie"] is Map){
            var cookieJson = json["cookie"] as Map<String, dynamic>;
            if(cookieJson.containsKey("__csrf")){
              result.csrf = cookieJson["__csrf"]?.toString() ?? "";
            }
            if(cookieJson.containsKey("MUSIC_U")){
              result.musicU = cookieJson["MUSIC_U"]?.toString() ?? "";
            }
          }
          break;
        case "migu":
          if(json["cookie"].runtimeType == Map){
            var cookieJson = json["cookie"] as Map<String, dynamic>;
            if(cookieJson.containsKey("cookie")){
              result.cookie = cookieJson["cookie"]?.toString() ?? "";
            }
            if(cookieJson.containsKey("uid")){
              result.uid = cookieJson["uid"]?.toString() ?? "";
            }
          }
          break;
        default:
          result.cookie = json["cookie"]?.toString() ?? "";
          break;
      }
    }
    return result;
  }
}