import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:musiche/log/logger.dart';
import 'package:musiche/server/tray_manager.dart';
import 'package:musiche/server/websocket_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../audio/audio_play.dart';
import '../utils/network.dart';
import 'http_handler.dart';

const String _tag = "MusicheServerManager";

class ServerManager {
  static int _port = 54621;
  static int get port => _port;
  static HttpServer? _server;
  static WebSocketHandler? _websocketHandler;
  static TrayManager? _trayManager;

  static Future<void> startServer() async {
    if(_server != null) return;
    AudioPlay audioPlay = AudioPlay();
    SharedPreferences? sharedPreferences;
    try{
      SharedPreferences.setPrefix("musiche");
      sharedPreferences = await SharedPreferences.getInstance();
    }catch(e){
      Logger.e(_tag, "init shared preferences error", error: e);
    }
    _websocketHandler = WebSocketHandler(audioPlay);
    _trayManager = TrayManager(_websocketHandler!);
    HttpHandler httpHandler = HttpHandler(audioPlay, _trayManager!, sharedPreferences);
    _port = kDebugMode ? 54621 : await Network.findAvailablePort();
    InternetAddress address = kDebugMode ? InternetAddress.anyIPv4 : InternetAddress('127.0.0.1');
    Logger.i(_tag, "start server: $address:$_port");
    try{
      _server = await HttpServer.bind(address, _port, shared: Platform.isMacOS);
    }catch(e){
      Logger.e(_tag, "start server error", error: e);
    }
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
}