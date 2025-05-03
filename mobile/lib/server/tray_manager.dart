import 'dart:io';

import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musiche/server/websocket_handler.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

import '../audio/audio_play.dart';
import '../audio/music_item.dart';
import '../log/logger.dart';
import '../utils/macos_channel.dart';

class TrayManager with TrayListener, WindowListener {
  static const String _tag = "MusicheWebSocketHandler";
  static const String _channelMediaOperate = "media-operate";
  late WebSocketHandler webSocketHandler;
  TrayManager(this.webSocketHandler) {
    webSocketHandler.audioPlay.onPlayerStateChanged.listen(_onPlayerStateChanged);
    webSocketHandler.audioPlay.onPositionChanged.listen(_onPositionChanged);
    webSocketHandler.audioPlay.onDurationChanged.listen(_onDurationChanged);
    webSocketHandler.audioPlay.onLoverChanged.listen(_onLoverChanged);
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

  void updateTrayList(){
    _setNotifyContextMenu();
  }

  void _setNotifyContextMenu(){
    MusicItem? music = webSocketHandler.audioPlay.getCurrentMusic();
    Menu menu = Menu(
      items: [
        MenuItem(
          key: 'show',
          label: music != null ? "${music.name} - ${music.singer}" : "音乐和",
        ),
        webSocketHandler.audioPlay.playing ? MenuItem(
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
                  checked: webSocketHandler.audioPlay.getLoopType() == LoopType.loop
              ),
              MenuItem(
                  key: 'loop_type_single',
                  label: '单曲循环',
                  type: 'checkbox',
                  checked: webSocketHandler.audioPlay.getLoopType() == LoopType.single
              ),
              MenuItem(
                  key: 'loop_type_random',
                  label: '随机播放',
                  type: 'checkbox',
                  checked: webSocketHandler.audioPlay.getLoopType() == LoopType.random
              ),
              MenuItem(
                  key: 'loop_type_order',
                  label: '顺序播放',
                  type: 'checkbox',
                  checked: webSocketHandler.audioPlay.getLoopType() == LoopType.order
              ),
            ])
        ),
        MenuItem.separator(),
        MenuItem(
          key: 'lyric',
          label: '桌面歌词',
          type: 'checkbox',
          checked: MacOSChannel.isLyricShow,
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
        case "loop_type_loop": webSocketHandler.audioPlay.setLoopType(LoopType.loop); break;
        case "loop_type_single": webSocketHandler.audioPlay.setLoopType(LoopType.single); break;
        case "loop_type_random": webSocketHandler.audioPlay.setLoopType(LoopType.random); break;
        case "loop_type_order": webSocketHandler.audioPlay.setLoopType(LoopType.order); break;
      }
      webSocketHandler.sendMessage('{"type": "loop", "data": "${webSocketHandler.audioPlay.getLoopType().name}"}');
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
          webSocketHandler.sendMessage('{"type": "show"}');
          break;
        case "lover":
          webSocketHandler.sendMessage('{"type": "lover"}');
          break;
        case "lyric":
          webSocketHandler.sendMessage('{"type": "lyric", "data": ${!MacOSChannel.isLyricShow}}');
          break;
        case "next": webSocketHandler.audioPlay.skipToNext(); break;
        case "last": webSocketHandler.audioPlay.skipToPrevious(); break;
        case "play": webSocketHandler.audioPlay.playCurrent(); break;
        case "playOrPause":
          if(webSocketHandler.audioPlay.playing) {
            webSocketHandler.audioPlay.playCurrent();
          } else {
            webSocketHandler.audioPlay.pause();
          }
          break;
        case "pause": webSocketHandler.audioPlay.pause(); break;
      }
    }else if(action is num){
      webSocketHandler.audioPlay.setPosition(action.toInt());
    }
  }

  _onPlayerStateChanged(PlayerState state) async {
    if(Platform.isMacOS) _setNotifyContextMenu();
    await webSocketHandler.sendStatus();
  }

  _onPositionChanged(Duration position) async {
    await webSocketHandler.sendStatus(position: position);
  }

  _onDurationChanged(Duration? duration) async {
    if(duration == null) return;
    await webSocketHandler.sendStatus(duration: duration);
  }

  _onLoverChanged(MusicItem music) async {
    webSocketHandler.sendMessage('{"type": "lover"}');
  }
}