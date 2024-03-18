import 'dart:convert';
import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';

import '../log/logger.dart';
import 'handler.dart';
import 'handler_Interface.dart';

class WebSocketHandler extends Handler implements IHandler {
  static const String _tag = "MusicheWebSocketHandler";
  final Set<WebSocket> webSockets = <WebSocket>{};
  static const String _channelMediaOperate = "media-operate";
  static bool _dark = false;
  WebSocketHandler(super.audioPlay) {
    audioPlay.onPlayerStateChanged.listen(_onPlayerStateChanged);
    audioPlay.onPositionChanged.listen(_onPositionChanged);
    audioPlay.onDurationChanged.listen(_onDurationChanged);
    if(Platform.isAndroid){
      EventChannel eventChannel = const EventChannel(_channelMediaOperate);
      eventChannel.receiveBroadcastStream().listen(_onMediaOperate);
    }
  }

  void changeTheme(bool isDark) {
    _dark = isDark;
    sendMessage("{\"type\": \"dark\", \"data\": $isDark}");
  }

  _onMediaOperate(dynamic action){
    if(action is String) {
      sendMessage("{\"type\": \"$action\"}");
    }else if(action is num){
      audioPlay.setPosition(action.toInt());
    }
  }

  _onPlayerStateChanged(PlayerState state) async {
    await _sendStatus();
    if(audioPlay.stopped) {
      await sendMessage("{\"type\": \"next\",\"data\": \"true\"}");
    }
  }

  _onPositionChanged(Duration position) async {
    await _sendStatus(position: position);
  }

  _onDurationChanged(Duration? duration) async {
    if(duration == null) return;
    await _sendStatus(duration: duration);
  }

  _sendStatus({Duration? position, Duration? duration}) async {
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
        if(data is! String) return;
        switch(data.trim()){
          case "/dark":
            sendMessage("{\"type\": \"dark\", \"data\": $_dark}");
            break;
        }
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