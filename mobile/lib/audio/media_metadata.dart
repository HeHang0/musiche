
import 'dart:convert';

import 'package:flutter/cupertino.dart';

import '../log/logger.dart';

class MediaImage {
  String src = "";
}

class MediaMetadata {
  static const String _tag = 'MusicheMediaMetadata';
  String album = "";
  String artist = "";
  String title = "";
  String artwork = "";
  bool lover = false;
  MediaMetadata();

  factory MediaMetadata.fromString(String source) {
    MediaMetadata result = MediaMetadata();

    Map<String, dynamic>? json;
    try {
      json = jsonDecode(source);
    }catch(e){
      Logger.e(_tag, "parse media metadata err: $e");
    }
    json?.forEach((key, value) {
      switch(key.toLowerCase()) {
        case "album":
          if (value.runtimeType == String) {
            result.album = value;
          }
          break;
        case "lover":
          if (value.runtimeType == bool) {
            result.lover = value;
          }
          break;
        case "artist":
          if (value.runtimeType == String) {
            result.artist = value;
          }
          break;
        case "title":
          if (value.runtimeType == String) {
            result.title = value;
          }
          break;
        case "artwork":
          if (value.runtimeType == List<dynamic>) {
            var list = value as List<dynamic>;
            for(dynamic item in list) {
              if(item is Map<String, dynamic> &&
                  item.containsKey("src") &&
                  item["src"] is String) {
                result.artwork = item["src"];
                break;
              }
            }
          }
          break;
      }
    });

    return result;
  }
}