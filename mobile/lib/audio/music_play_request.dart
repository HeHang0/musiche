import 'dart:convert';

import '../log/logger.dart';
import 'music_item.dart';

class MusicPlayRequest {
  static const String _tag = 'MusicheMediaMetadata';
  MusicItem? music;
  int index = 0;
  List<MusicItem> playlist = [];
  MusicPlayRequest();

  factory MusicPlayRequest.fromString(String source){
    MusicPlayRequest result = MusicPlayRequest();

    Map<String, dynamic>? json;
    try {
      json = jsonDecode(source);
    }catch(e){
      Logger.e(_tag, "parse media metadata err: $e");
    }
    if(json?.containsKey("music") ?? false) {
      var music = MusicItem.from(json!["music"]);
      if(music.id.isNotEmpty) result.music = music;
    }
    if(json?.containsKey("playlist") ?? false) {
      if (json!["playlist"].runtimeType == List) {
        var playlist = json["playlist"] as List;
        for (var element in playlist) {
          var m = MusicItem.from(element);
          if(m.id.isNotEmpty) result.playlist.add(m);
        }
      }
    }
    json?.forEach((key, value) {
      switch(key.toLowerCase()) {
        case "music":
          break;
        case "playlist":
          if (value.runtimeType == List) {
            var playlist = value as List;
            for (var element in playlist) {
              var m = MusicItem.from(element);
              if(m.id.isNotEmpty) result.playlist.add(m);
            }
          }
          break;
      }
    });
    return result;
  }
}