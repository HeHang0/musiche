import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:musiche/log/logger.dart';
import 'package:musiche/server/websocket_handler.dart';

import '../audio/audio_play.dart';
import '../utils/network.dart';
import 'http_handler.dart';

const String _tag = "MusicheServerManager";

class ServerManager {
  static int _port = 54621;
  static int get port => _port;
  static HttpServer? _server;
  static WebSocketHandler? _websocketHandler;

  static Future<void> startServer() async {
    if(_server != null) return;
    AudioPlay audioPlay = AudioPlay();
    HttpHandler httpHandler = HttpHandler(audioPlay);
    _websocketHandler = WebSocketHandler(audioPlay);
    _port = kDebugMode ? 54621 : await Network.findAvailablePort();
    InternetAddress address = kDebugMode ? InternetAddress.anyIPv4 : InternetAddress.loopbackIPv4;
    _server = await HttpServer.bind(address, _port, shared: Platform.isMacOS);
    Logger.i(_tag, "start server: $address:$_port");
    _server?.forEach((HttpRequest request) {
      Logger.d(_tag, "accept connection: ${request.uri.path}");
      Network.processCors(request.response);
      if (WebSocketTransformer.isUpgradeRequest(request)) {
        _websocketHandler?.handle(request);
      } else {
        httpHandler.handle(request);
      }
    });
  }

  static void changeTheme(bool isDark) {
    _websocketHandler?.changeTheme(isDark);
  }
}