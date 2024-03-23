import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:id3tag/id3tag.dart';
import 'package:musiche/log/logger.dart';
import 'package:musiche/server/handler_interface.dart';
import 'package:musiche/server/proxy_request_data.dart';
import 'package:musiche/server/proxy_response_data.dart';
import 'package:musiche/utils/android_channel.dart';
import 'package:musiche/utils/macos_channel.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../audio/music_play_request.dart';
import '../utils/os_version.dart';
import 'file_handler.dart';
import 'http_proxy.dart';
import 'router_call.dart';
import 'handler.dart';

class HttpHandler extends Handler implements IHandler {
  static const String _tag = 'MusicheHttpHandler';
  Map<String, RouterCall> routers = <String, RouterCall>{};
  final SharedPreferences? sharedPreferences;
  HttpHandler(super.audioPlay, this.sharedPreferences){
    routers.addEntries([
      MapEntry("*", _handleIndex),
      MapEntry("config", _handleConfig),
      MapEntry("version", _getVersion),
      MapEntry("title", _setTitle),
      MapEntry("media", _setMedia),
      MapEntry("fadein", _setFadeIn),
      MapEntry("delayexit", _setDelayExit),
      MapEntry("updatelist", _updateList),
      MapEntry("play", _play),
      MapEntry("pause", _pause),
      MapEntry("progress", _setProgress),
      MapEntry("volume", _setVolume),
      MapEntry("status", _getStatus),
      MapEntry("storages", _getAllStorages),
      MapEntry("storage", _storage),
      MapEntry("theme", _setTheme),
      MapEntry("window", _voidRouter),
      MapEntry("hotkey", _voidRouter),
      MapEntry("gpu", _setGPU),
      MapEntry("loop", _setLoopType),
      MapEntry("fonts", _getInstalledFonts),
      MapEntry("image", _getMusicImage),
      MapEntry("lyric", _setLyric),
      MapEntry("lyricline", _setLyricLine),
      MapEntry("proxy", _proxy),
      MapEntry("file", _readFile),
      MapEntry("file/read", _handleFiles),
      MapEntry("file/write", _handleFiles),
      MapEntry("file/delete", _handleFiles),
      MapEntry("file/exists", _handleFiles),
      MapEntry("file/select", _handleFiles),
      MapEntry("file/select/image", _handleFiles),
      MapEntry("file/directory/music", _handleFiles),
      MapEntry("file/list/all", _handleFiles),
      MapEntry("file/list/audio", _handleFiles)
    ]);
  }

  Future<void> _readFile(HttpRequest request) async {
    String filePath = (request.uri.queryParameters["path"] ?? "").trim();
    try {
      final file = File(filePath);
      final data = await file.readAsBytes();
      request.response.statusCode = HttpStatus.ok;
      request.response.headers.contentType = ContentType.parse(getMimeType(filePath));
      request.response.add(data);
    }catch(e){
      request.response.statusCode = HttpStatus.notFound;
    }
  }

  Future<void> _handleFiles(HttpRequest request) async {
    dynamic data;
    Map<String, dynamic> result = <String, dynamic>{};
    String body = await _readBody(request);
    switch(request.uri.path.toLowerCase()){
      case "/file/read":
        data = await FileHandler.handlers["readFile"]!.call([]);break;
      case "/file/write":
        data = await FileHandler.handlers["writeFile"]!.call([]);break;
      case "/file/delete":
        data = await FileHandler.handlers["deleteFile"]!.call([body]);break;
      case "/file/exists":
        data = await FileHandler.handlers["fileExists"]!.call([body]);break;
      case "/file/select":
        data = await FileHandler.handlers["showSelectedDirectory"]!.call([]);break;
      case "/file/select/image":
        data = await FileHandler.handlers["showSelectedImage"]!.call([]);break;
      case "/file/directory/music":
        data = await FileHandler.handlers["getMyMusicDirectory"]!.call([]);break;
      case "/file/list/all":
        data = await FileHandler.handlers["listAllFiles"]!.call([]);break;
      case "/file/list/audio":
        data = await FileHandler.handlers["listAllAudios"]!.call([body, true]);break;
      default:
        data = null;
    }
    result["data"] = data;
    request.response.statusCode = HttpStatus.ok;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(result));
  }

  Future<void> _handleConfig(HttpRequest request) async {
    Map<String, dynamic> result = <String, dynamic>{};
    result["remote"] = true;
    result["storage"] = true;
    result["file"] = !Platform.isIOS;
    result["list"] = true;
    result["client"] = false;
    result["lyric"] = Platform.isAndroid || Platform.isMacOS;
    result["shortcut"] = false;
    result["gpu"] = false;
    request.response.statusCode = HttpStatus.ok;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(result));
  }

  Future<void> _handleIndex(HttpRequest request) async {
    String realPath = request.uri.path.replaceAll(RegExp(r'^/'), '');
    if (realPath.isEmpty)
    {
      realPath = "index.html";
    }
    Uint8List? result;
    try{
      result = Uint8List.sublistView(await rootBundle.load('assets/$realPath'));
    }catch(e){
      try{
        result = Uint8List.sublistView(await rootBundle.load('assets/index.html'));
      }catch(e){
        Logger.e(_tag, "load file err", error: e);
      }
    }
    if(result == null){
      request.response.headers.set("Location", "/?redirect=${request.uri.path}");
      request.response.statusCode = HttpStatus.movedTemporarily;
      return;
    }
    request.response.headers.contentType = ContentType.parse(getMimeType(realPath));
    request.response.statusCode = HttpStatus.ok;
    request.response.add(result);
  }

  String getMimeType(String filePath){
    List<String> parts = filePath.trim().split('.');
    switch (parts.isNotEmpty ? parts[parts.length - 1] : 'html')
    {
      case "html":
        return "text/html";
      case "js":
        return "application/javascript; charset=utf-8";
      case "json":
        return "application/json; charset=utf-8";
      case "css":
        return "text/css; charset=utf-8";
      case "woff":
        return "font/woff";
      case "woff2":
        return "font/woff2";
      case "otf":
        return "font/otf";
      case "png":
        return "image/png";
      case "jpg":
        return "image/jpeg";
      case "webp":
        return "image/webp";
      case "webm":
        return "video/webm";
    }
    return "text/html";
  }

  Future<void> _getAllStorages(HttpRequest request) async {
    Map<String, dynamic> result = <String, dynamic>{};
    sharedPreferences?.getKeys().forEach((key) {
      result[key] = sharedPreferences!.getString(key);
    });
    request.response.statusCode = HttpStatus.ok;
    request.response.write(jsonEncode(result));
  }

  Future<void> _storage(HttpRequest request) async {
    String key = (request.uri.queryParameters["key"] ?? "").trim();
    if(key.isEmpty) {
      request.response.statusCode = HttpStatus.ok;
      request.response.write("");
      return;
    }
    String result = "";
    switch(request.method.toUpperCase()){
      case "GET":
        result = sharedPreferences?.getString(key) ?? "";
        break;
      case "POST":
        String text = await _readBody(request);
        sharedPreferences?.setString(key, text);
        break;
      case "DELETE":
        sharedPreferences?.remove(key);
        break;
    }
    request.response.statusCode = HttpStatus.ok;
    request.response.write(result.trim());
  }

  Future<void> _getVersion(HttpRequest request) async {
    String result = await rootBundle.loadString("assets/version");
    request.response.statusCode = HttpStatus.ok;
    request.response.write(result.trim());
  }

  Future<void> _setTitle(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _setMedia(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _setFadeIn(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Timer? _delayExit;
  Future<void> _setDelayExit(HttpRequest request) async {
    _delayExit?.cancel();
    int delay = int.tryParse(await _readBody(request)) ?? 0;
    if(delay > 0){
      _delayExit = Timer(Duration(minutes: delay), exitApp);
    }
    request.response.statusCode = HttpStatus.ok;
  }

  void exitApp(){
    exit(0);
  }

  Future<void> _setGPU(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _updateList(HttpRequest request) async {
    MusicPlayRequest musicPlayRequest = MusicPlayRequest.fromString(await _readBody(request));
    audioPlay.setMusicPlayRequest(musicPlayRequest);
  }

  Future<void> _play(HttpRequest request) async {
    await audioPlay.playUrl(await _readBody(request));
    await _sendStatus(request);
  }

  Future<void> _pause(HttpRequest request) async {
    audioPlay.pause();
    await _sendStatus(request);
  }

  Future<void> _setProgress(HttpRequest request) async {
    int? progress = int.tryParse(await _readBody(request));
    if (progress != null) {
      await audioPlay.setProgress(progress);
    }
    await _sendStatus(request);
  }

  Future<void> _setVolume(HttpRequest request) async {
    int? volume = int.tryParse(await _readBody(request));
    if (volume != null) {
      audioPlay.setVolume(volume);
    }
    await _sendStatus(request);
  }

  Future<void> _getStatus(HttpRequest request) async {
    await _sendStatus(request);
  }

  Future<void> _setTheme(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
    String themeString = request.uri.queryParameters["theme"] ?? "";
    Brightness brightness = themeString == "1" ? Brightness.dark : Brightness.light;
    if(Platform.isIOS || Platform.isMacOS) brightness = themeString == "1" ? Brightness.light : Brightness.dark;
    if (kIsWeb) {
      return;
    }
    var androidInfo = await OSVersion.androidInfo;
    var sdkInt = androidInfo?.version.sdkInt ?? 0;
    if(!Platform.isAndroid || (sdkInt >= 23 && sdkInt < 34)){
      SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarBrightness: brightness,
        statusBarIconBrightness: brightness,
        systemStatusBarContrastEnforced: false,
        systemNavigationBarContrastEnforced: false,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarIconBrightness: brightness,
        systemNavigationBarDividerColor: Colors.transparent,
      ));
      final saved = (request.uri.queryParameters["saved"] ?? "0") == "1";
      if(Platform.isMacOS && saved){
        final auto = (request.uri.queryParameters["auto"] ?? "0") == "1";
        MacOSChannel.theme(themeString != "1", auto);
      }
    }else {
      if(Platform.isAndroid) AndroidChannel.setStatusBarTheme(themeString != "1");
    }
  }

  Future<void> _voidRouter(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _setLoopType(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _getInstalledFonts(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
    if(!kIsWeb && Platform.isMacOS){
      request.response.headers.set("content-type", "application/json");
      request.response.write(jsonEncode(await MacOSChannel.getFonts()));
    }
  }

  Future<void> _getMusicImage(HttpRequest request) async {
    var filePath = request.uri.queryParameters["path"];
    if (filePath?.isNotEmpty ?? false) {
      if(filePath!.startsWith("content://")){
        List<int>? imageData = [];
        if(kIsWeb) return;
        if(!kIsWeb && Platform.isAndroid){
          imageData = await AndroidChannel.getThumbnail(filePath);
        }
        if(imageData != null) {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.parse("image/jpeg");
          request.response.add(imageData);
        }
      }
      File file = File(filePath);
      if (await file.exists()) {
        final parser = ID3TagReader(file);
        final tag = await parser.readTag();
        if(tag.pictures.isNotEmpty){
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.parse(tag.pictures[0].mime);
          request.response.add(tag.pictures[0].imageData);
          return;
        }
      }
    }
    request.response.statusCode = HttpStatus.notFound;
  }

  Future<void> _setLyric(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
    if(kIsWeb || (!Platform.isAndroid && !Platform.isMacOS)) return;
    Map<String, dynamic> lyricOptions = jsonDecode(await _readBody(request));
    try {
      var androidInfo = await OSVersion.androidInfo;
      if(Platform.isMacOS){
        MacOSChannel.setLyricOptions(lyricOptions);
      } else if((androidInfo?.version.sdkInt ?? 0) >= 23){
        var status = await Permission.systemAlertWindow.status;
        bool show = lyricOptions.containsKey("show") &&
            lyricOptions["show"] is bool && lyricOptions["show"];
        if (show && !status.isGranted) {
          status = await Permission.systemAlertWindow.request();
        }
        if(status.isGranted){
          AndroidChannel.setLyricOptions(lyricOptions);
        }
      } else {
        AndroidChannel.setLyricOptions(lyricOptions);
      }
    }catch(e){
      Logger.e(_tag, "parse lyric options err: $e");
    }
  }

  Future<void> _setLyricLine(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
    if(kIsWeb || (!Platform.isAndroid && !Platform.isMacOS)) return;
    var androidInfo = await OSVersion.androidInfo;
    String line = await _readBody(request);
    if(Platform.isMacOS){
      MacOSChannel.setLyricLine(line);
      return;
    }
    bool isGranted = true;
    if((androidInfo?.version.sdkInt ?? 0) >= 23){
      isGranted = (await Permission.systemAlertWindow.status).isGranted;
    }
    if(isGranted){
      AndroidChannel.setLyricLine(line);
    }
  }

  Future<void> _proxy(HttpRequest request) async {
    String queryUrl = request.uri.queryParameters["url"] ?? "";
    var proxyData = ProxyRequestData.fromString(queryUrl.isEmpty ? await _readBody(request) : queryUrl);
    ProxyResponseData proxyResData = await HttpProxy.request(proxyData);
    if (proxyResData.statusCode > 300 && proxyResData.statusCode < 310)
    {
      request.response.statusCode = HttpStatus.ok;
      request.response.headers.set("content-type", "application/json");
      Map<String, String> headerSingle = <String, String>{};
      proxyResData.headers?.forEach((key, values) {
        headerSingle[key] = values.join(";");
      });
      request.response.write(jsonEncode(headerSingle));
    }else {
      _setHeader(request.response, proxyResData.headers);
      request.response.headers.chunkedTransferEncoding = false;
      request.response.statusCode = proxyResData.statusCode;
      // if (proxyResData.contentLength > 0) {
      //   request.response.contentLength = proxyResData.contentLength;
      // }
      if (proxyResData.stream != null) {
        await request.response.addStream(proxyResData.stream!);
      }else if(proxyResData.data.isNotEmpty) {
        request.response.write(proxyResData.data);
      }
    }
  }

  Future<void> _sendStatus(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(await getStatus()));
  }

  static Future<String> _readBody(HttpRequest request) async {
    return await utf8.decoder.bind(request).join();
  }

  @override
  handle(HttpRequest request) async {
    request.response.persistentConnection = false;
    if (request.method.toUpperCase() == "OPTIONS")
    {
      request.response.close();
      return;
    }
    String router = request.uri.path;
    if(router.endsWith("/")) router = router.substring(0, router.length - 1);
    if(router.startsWith("/")) router = router.substring(1);
    if(router.isEmpty) router = "*";
    router = router.toLowerCase();
    if(!routers.containsKey(router)){
      router = "*";
    }
    RouterCall? func = routers[router];
    try {
      await func?.call(request);
    } catch(e){
      Logger.e(_tag, "http request err: $e");
    } finally {
      await request.response.flush();
      await request.response.close();
    }
  }

  static _setHeader(HttpResponse response, Map<String, List<String>>? headers) {
    headers?.forEach((key, values) {
      try {
        for (var value in values) {
          String keyLower = key.toLowerCase().replaceAll("-", "");
          switch (keyLower)
          {
            // case "cookies":
            case "connection":
            // case "contentencoding":
            // case "contentlength":
            // case "transferencoding":
            case "accesscontrolalloworigin":
            case "accesscontrolallowheaders":
            case "accesscontrolallowmethods":
            case "accesscontrolexposeheaders":
            case "accesscontrolallowcredentials":
              break;
            default:
              response.headers.add(key, value);
              break;
          }
        }
      } catch(e) {
        Logger.e(_tag, "set http proxy header error: $e");
      }
    });
  }
}