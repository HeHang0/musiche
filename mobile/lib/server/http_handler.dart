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
import 'package:permission_handler/permission_handler.dart';

import '../audio/media_metadata.dart';
import '../utils/os_version.dart';
import 'http_proxy.dart';
import 'router_call.dart';
import 'handler.dart';

class HttpHandler extends Handler implements IHandler {
  static const String _tag = 'MusicheHttpHandler';
  Map<String, RouterCall> routers = <String, RouterCall>{};
  HttpHandler(super.audioPlay){
    routers.addEntries([
      MapEntry("*", _handleIndex),
      MapEntry("version", _getVersion),
      MapEntry("title", _setTitle),
      MapEntry("media", _setMedia),
      MapEntry("fadein", _setFadeIn),
      MapEntry("delayexit", _setDelayExit),
      MapEntry("play", _play),
      MapEntry("pause", _pause),
      MapEntry("progress", _setProgress),
      MapEntry("volume", _setVolume),
      MapEntry("status", _getStatus),
      MapEntry("theme", _setTheme),
      MapEntry("window", _voidRouter),
      MapEntry("hotkey", _voidRouter),
      MapEntry("gpu", _setGPU),
      MapEntry("loop", _setLoopType),
      MapEntry("fonts", _getInstalledFonts),
      MapEntry("image", _getMusicImage),
      MapEntry("lyric", _setLyric),
      MapEntry("lyricline", _setLyricLine),
      MapEntry("proxy", _proxy)
    ]);
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
      Logger.e(_tag, "load file err", error: e);
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

  Future<void> _getVersion(HttpRequest request) async {
    String result = await rootBundle.loadString("assets/version");
    request.response.statusCode = HttpStatus.ok;
    request.response.write(result.trim());
  }

  Future<void> _setTitle(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _setMedia(HttpRequest request) async {
    var mediaMetadata = MediaMetadata.fromString(await _readBody(request));
    audioPlay.setMediaMeta(mediaMetadata);
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

  Future<void> _play(HttpRequest request) async {
    await audioPlay.play(await _readBody(request));
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
    request.response.statusCode = HttpStatus.ok;
    // int? volume = int.tryParse(await _readBody(request));
    // if (volume != null) {
    //   audioPlay.setVolume(volume);
    // }
    // await _sendStatus(request);
  }

  Future<void> _getStatus(HttpRequest request) async {
    await _sendStatus(request);
  }

  Future<void> _setTheme(HttpRequest request) async {
    request.response.statusCode = HttpStatus.ok;
    String themeString = request.uri.queryParameters["theme"] ?? "";
    Brightness brightness = themeString == "1" ? Brightness.dark : Brightness.light;
    if (!kIsWeb && Platform.isAndroid) {
      var androidInfo = await OSVersion.androidInfo;
      var sdkInt = androidInfo?.version.sdkInt ?? 0;
      if(sdkInt >= 23 && sdkInt < 34){
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
      }else {
        AndroidChannel.setStatusBarTheme(themeString != "1");
      }
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
  }

  Future<void> _getMusicImage(HttpRequest request) async {
    var filePath = request.uri.queryParameters["path"];
    if (filePath?.isNotEmpty ?? false) {
      if(filePath!.startsWith("content://")){
        List<int>? imageData = await AndroidChannel.getThumbnail(filePath);
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
    if(!kIsWeb && Platform.isAndroid){
      try {
        Map<String, dynamic> lyricOptions = jsonDecode(await _readBody(request));
        var androidInfo = await OSVersion.androidInfo;
        bool show = lyricOptions.containsKey("show") &&
            lyricOptions["show"] is bool && lyricOptions["show"];
        if((androidInfo?.version.sdkInt ?? 0) >= 23){
          var status = await Permission.systemAlertWindow.status;
          if (show && !status.isGranted) {
            status = await Permission.systemAlertWindow.request();
          }
          if(status.isGranted){
            AndroidChannel.setLyricOptions(lyricOptions);
          }
        }else {
          AndroidChannel.setLyricOptions(lyricOptions);
        }
      }catch(e){
        Logger.e(_tag, "parse lyric options err: $e");
      }
    }
    request.response.statusCode = HttpStatus.ok;
  }

  Future<void> _setLyricLine(HttpRequest request) async {
    var androidInfo = await OSVersion.androidInfo;
    bool isGranted = true;
    if((androidInfo?.version.sdkInt ?? 0) >= 23){
      isGranted = (await Permission.systemAlertWindow.status).isGranted;
    }
    if(isGranted){
      AndroidChannel.setLyricLine(await _readBody(request));
    }
    request.response.statusCode = HttpStatus.ok;
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
      if (proxyResData.contentLength > 0) {
        request.response.contentLength = proxyResData.contentLength;
      }
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