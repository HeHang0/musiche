import 'dart:convert';

import 'package:musiche/log/logger.dart';

class ProxyRequestData {
  static const String _tag = 'MusicheProxyRequestData';
  String url = "";
  bool setCookieRename = false;
  bool allowAutoRedirect = true;
  Map<String, dynamic>? headers;
  String method = "GET";
  String data = "";
  bool get hasBody => data.isNotEmpty;

  ProxyRequestData();

  factory ProxyRequestData.fromString(String source) {
    ProxyRequestData result = ProxyRequestData();
    if (source.startsWith("http")){
      result.url = source;
      return result;
    }
    Map<String, dynamic>? json;
    try {
      json = jsonDecode(source);
    }catch(e){
      Logger.e(_tag, "parse proxy request data err: $e");
    }
    json?.forEach((key, value) {
      switch(key.toLowerCase()){
        case "url":
          if(value.runtimeType == String) {
            result.url = value;
          }
          break;
        case "setcookierename":
          if(value.runtimeType == bool) {
            result.setCookieRename = value;
          }
          break;
        case "allowautoredirect":
          if(value.runtimeType == bool) {
            result.allowAutoRedirect = value;
          }
          break;
        case "headers":
          if(value is Map<String, dynamic>) {
            result.headers = value.map((key, value) {
              return MapEntry(key, value?.toString() ?? "");
            });
          }
          break;
        case "method":
          if(value.runtimeType == String && value.toString().isNotEmpty) {
            result.method = value;
          }
          break;
        case "data":
          if(value.runtimeType == String) {
            result.data = value;
          }
          break;
      }
    });
    return result;
  }
}