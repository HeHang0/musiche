
import 'dart:convert';

import 'package:flutter/cupertino.dart';

import '../log/logger.dart';

class LyricOptions {
  static const String _tag = 'MusicheLyricOptions';
  bool show = false;
  String title = '';
  int fontSize = 20;
  bool fontBold = false;
  // String fontFamily = '';
  String effectColor = '';
  String fontColor = '';
  LyricOptions();

  factory LyricOptions.fromString(String source) {
    LyricOptions result = LyricOptions();

    Map<String, dynamic>? json;
    try {
      json = jsonDecode(source);
    }catch(e){
      Logger.e(_tag, "parse lyric options err: $e");
    }
    json?.forEach((key, value) {
      switch(key.toLowerCase()) {
        case "show":
          if (value.runtimeType == bool) {
            result.show = value;
          }
          break;
        case "title":
          if (value.runtimeType == String) {
            result.title = value;
          }
          break;
        case "effectcolor":
          if (value.runtimeType == String) {
            result.effectColor = value;
          }
          break;
        case "fontcolor":
          if (value.runtimeType == String) {
            result.fontColor = value;
          }
          break;
        case "fontsize":
          if (value.runtimeType is num) {
            result.fontSize = value;
          }
          break;
        case "fontbold":
          if (value.runtimeType == bool) {
            result.fontBold = value;
          }
          break;
      }
    });

    return result;
  }
}