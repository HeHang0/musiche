import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/services.dart';
import 'package:musiche/audio/audio_tag.dart';
import 'package:musiche/utils/utils.dart';
import 'package:permission_handler/permission_handler.dart';

class AndroidChannel {
  static const _channel = "musiche-method-channel";
  static const _methodBackToHome = "back-to-home";
  static const _methodMediaMetadata = "media-metadata";
  static const _methodMediaPosition = "media-position";
  static const _methodLyricOptions = "lyric-options";
  static const _methodLyricLine = "lyric-line";
  static const _methodStatusBarTheme = "status-bar-theme";
  static const _methodSaveTheme = "save-theme";
  static const _methodMediaAudioAll = "media-audio-all";
  static const _methodMediaThumbnail = "media-thumbnail";
  static final MethodChannel? _methodChannel = Platform.isAndroid ? const MethodChannel(_channel) : null;

  static Future<void> backToHome() async {
    await _methodChannel?.invokeMethod(_methodBackToHome);
  }

  static Future<void> setMediaMetadata(MediaItem metadata, bool lover, bool playing, int position, int duration) async {
    var status = await Permission.notification.status;
    if (!status.isGranted) {
      status = await Permission.notification.request();
    }
    if (!status.isGranted) {
      return;
    }
    final Map<String, dynamic> params = <String, dynamic>{
      'album': metadata.album,
      'artist': metadata.artist,
      'title': metadata.title,
      'artwork': metadata.artUri?.toString() ?? "",
      'lover': lover,
      'playing': playing,
      'position': position,
      'duration': duration
    };
    _methodChannel?.invokeMethod(_methodMediaMetadata, params);
  }

  static Future<void> setMediaPosition(bool playing, int position)async {
    var status = await Permission.notification.status;
    if (!status.isGranted) {
      return;
    }
    final Map<String, dynamic> params = <String, dynamic>{
      'playing': playing,
      'position': position,
    };
    try{
      _methodChannel?.invokeMethod(_methodMediaPosition, params);
    }catch(e){ }
  }

  static Future<void> setLyricOptions(Map<String, dynamic> lyricOptions)async {
    _methodChannel?.invokeMethod(_methodLyricOptions, lyricOptions);
  }

  static Future<void> setLyricLine(String line)async {
    final Map<String, dynamic> params = <String, dynamic>{
      'line': line,
    };
    _methodChannel?.invokeMethod(_methodLyricLine, params);
  }

  static Future<void> setStatusBarTheme(bool dark, bool auto, bool saved) async {
    final Map<String, dynamic> params = <String, dynamic>{
      'dark': dark,
      'auto': auto,
      'saved': saved
    };
    _methodChannel?.invokeMethod(_methodStatusBarTheme, params);
  }

  static Future<void> saveTheme(bool dark, bool auto) async {
    final Map<String, dynamic> params = <String, dynamic>{
      'dark': dark,
      'auto': auto
    };
    _methodChannel?.invokeMethod(_methodSaveTheme, params);
  }

  static Future<List<Map<String, dynamic>>> getAllAudio() async {
    List<Map<String, dynamic>> audios = [];
    List<Object?>? result = await _methodChannel?.invokeMethod<List<Object?>>(_methodMediaAudioAll);
    result?.forEach((element) {
      if(element is Map){
        String id = "";
        String name = "";
        String singer = "";
        String album = "";
        int length = 0;
        String duration = "";
        String url = "";
        element.forEach((key, value) {
          if(key is String){
            switch(key){
              case "id":
                if(value is String) id = value;
                break;
              case "url":
                if(value is String) url = value;
                break;
              case "duration":
                if(value is num) {
                  length = value as int;
                  duration = formatDuration(Duration(milliseconds: value));
                }
                break;
              case "album":
                if(value is String) album = value;
                break;
              case "singer":
                if(value is String) singer = value;
                break;
              case "name":
                if(value is String) name = value;
                break;
            }
          }
        });
        if(id.isNotEmpty && name.isNotEmpty){
          audios.add(AudioTag(id: id, name: name, singer: singer, album: album, length: length, duration: duration, url: url).asMap());
        }
      }
    });
    return audios;
  }

  static Future<List<int>?> getThumbnail(String uri) async {
    final Map<String, dynamic> params = <String, dynamic>{
      'uri': uri,
    };
    List<int>? result = await _methodChannel?.invokeMethod<List<int>>(_methodMediaThumbnail, params);
    return result;
  }
}