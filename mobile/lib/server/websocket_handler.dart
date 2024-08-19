import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musiche/audio/audio_play.dart';
import 'package:musiche/audio/music_item.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

import '../log/logger.dart';
import 'handler.dart';
import 'handler_Interface.dart';

class WebSocketHandler extends Handler with TrayListener, WindowListener implements IHandler {
  static const String _tag = "MusicheWebSocketHandler";
  final Set<WebSocket> webSockets = <WebSocket>{};
  static const String _channelMediaOperate = "media-operate";
  WebSocketHandler(super.audioPlay) {
    audioPlay.onPlayerStateChanged.listen(_onPlayerStateChanged);
    audioPlay.onPositionChanged.listen(_onPositionChanged);
    audioPlay.onDurationChanged.listen(_onDurationChanged);
    audioPlay.onLoverChanged.listen(_onLoverChanged);
    if(Platform.isAndroid){
      EventChannel eventChannel = const EventChannel(_channelMediaOperate);
      eventChannel.receiveBroadcastStream().listen(_onMediaOperate);
    }
    if(Platform.isMacOS) _initNotifyIcon();
  }

  void _initNotifyIcon() async {
    await trayManager.setIcon('assets/logo-circle.png');
    _setNotifyContextMenu();
    trayManager.addListener(this);
  }

  void _setNotifyContextMenu(){
    MusicItem? music = audioPlay.getCurrentMusic();
    Menu menu = Menu(
      items: [
        MenuItem(
          key: 'show',
          label: music != null ? "${music.name} - ${music.singer}" : "音乐和",
        ),
        audioPlay.playing ? MenuItem(
          key: 'pause',
          label: '暂停',
        ) : MenuItem(
          key: 'play',
          label: '播放',
        ),
        MenuItem(
          key: 'last',
          label: '上一首',
        ),
        MenuItem(
          key: 'next',
          label: '下一首',
        ),
        MenuItem.separator(),
        MenuItem(
          key: 'loop_type',
          label: '列表循环',
          type: 'submenu',
          submenu: Menu(items: [
            MenuItem(
                key: 'loop_type_loop',
                label: '列表循环',
                type: 'checkbox',
                checked: audioPlay.getLoopType() == LoopType.loop
            ),
            MenuItem(
                key: 'loop_type_single',
                label: '单曲循环',
                type: 'checkbox',
                checked: audioPlay.getLoopType() == LoopType.single
            ),
            MenuItem(
                key: 'loop_type_random',
                label: '随机播放',
                type: 'checkbox',
                checked: audioPlay.getLoopType() == LoopType.random
            ),
            MenuItem(
                key: 'loop_type_order',
                label: '顺序播放',
                type: 'checkbox',
                checked: audioPlay.getLoopType() == LoopType.order
            ),
          ])
        ),
        MenuItem.separator(),
        MenuItem(
          key: 'exit',
          label: '退出',
        ),
      ],
    );
    trayManager.setContextMenu(menu);
  }

  @override
  void onWindowClose() async {
    if(await windowManager.isPreventClose()) {
      windowManager.hide();
    }
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    Logger.i(_tag, "onTrayMenuItemClick: ${menuItem.key}");
    if (menuItem.key == null || menuItem.key == 'loop_type') {
      return;
    }
    if(menuItem.key!.startsWith("exit")){
      windowManager.destroy();
      trayManager.destroy();
      exit(0);
    }
    if(menuItem.key!.startsWith("loop_type_")){
      switch(menuItem.key){
        case "loop_type_loop": audioPlay.setLoopType(LoopType.loop); break;
        case "loop_type_single": audioPlay.setLoopType(LoopType.single); break;
        case "loop_type_random": audioPlay.setLoopType(LoopType.random); break;
        case "loop_type_order": audioPlay.setLoopType(LoopType.order); break;
      }
      sendMessage('{"type": "loop", "data": "${audioPlay.getLoopType().name}"}');
      return;
    }
    _onMediaOperate(menuItem.key);
  }

  @override onTrayIconMouseUp(){
    Logger.i(_tag, "onTrayIconMouseUp");
    trayManager.popUpContextMenu();
  }

  _onMediaOperate(dynamic action){
    if(action is String) {
      switch(action){
        case "show":
          windowManager.show();
          sendMessage('{"type": "show"}');
          break;
        case "lover":
          sendMessage('{"type": "lover"}');
          break;
        case "next": audioPlay.skipToNext(); break;
        case "last": audioPlay.skipToPrevious(); break;
        case "play": audioPlay.playCurrent(); break;
        case "playOrPause":
          if(audioPlay.playing) {
            audioPlay.playCurrent();
          } else {
            audioPlay.pause();
          }
          break;
        case "pause": audioPlay.pause(); break;
      }
    }else if(action is num){
      audioPlay.setPosition(action.toInt());
    }
  }

  _onPlayerStateChanged(PlayerState state) async {
    if(Platform.isMacOS) _setNotifyContextMenu();
    await _sendStatus();
  }

  _onPositionChanged(Duration position) async {
    await _sendStatus(position: position);
  }

  _onDurationChanged(Duration? duration) async {
    if(duration == null) return;
    await _sendStatus(duration: duration);
  }

  _onLoverChanged(MusicItem music) async {
    sendMessage('{"type": "lover"}');
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