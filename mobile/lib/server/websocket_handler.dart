import 'dart:convert';
import 'dart:io';

import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

import '../log/logger.dart';
import 'handler.dart';
import 'handler_Interface.dart';

class WebSocketHandler extends Handler with TrayListener, WindowListener implements IHandler {
  static const String _tag = "MusicheWebSocketHandler";
  final Set<WebSocket> webSockets = <WebSocket>{};
  static const String _channelMediaOperate = "media-operate";
  WebSocketHandler(super.audioPlay);

  sendStatus({Duration? position, Duration? duration}) async {
    Map<String, dynamic> status = await getStatus(duration: duration);
    status["type"] = "status";
    await sendMessage(jsonEncode(status));
  }

  @override
  handle(HttpRequest request) {
    WebSocketTransformer.upgrade(request).then((WebSocket webSocket) {
      webSockets.add(webSocket);
      webSocket.listen((dynamic data) {
        Logger.i(_tag, 'WebSocket received: $data');
      }, onDone: () {
        webSockets.remove(webSocket);
      });
    });
  }

  sendMessage(String message)
  {
    try{
      for (WebSocket webSocket in webSockets)
      {
        webSocket.add(message);
      }
    }catch(e){
      Logger.e(_tag, 'WebSocket send err', error: e);
    }
  }
}