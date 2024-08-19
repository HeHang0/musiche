import 'dart:convert';
import 'dart:io';

import 'package:flutter/cupertino.dart';

import '../log/logger.dart';
import 'proxy_request_data.dart';
import 'proxy_response_data.dart';

class HttpProxy {
  static const String _tag = 'MusicheHttpProxy';
  static Future<ProxyResponseData> request(ProxyRequestData data) async {
    var httpClient = HttpClient();
    ProxyResponseData result;
    try {
      var request = await httpClient.openUrl(data.method, Uri.parse(data.url));
      request.followRedirects = data.allowAutoRedirect;
      request.headers.removeAll("accept-encoding");
      _setHeader(request, data.headers);
      if (data.hasBody) {
        request.contentLength = data.data.length;
        request.write(data.data);
      }
      var response = await request.close();
      Map<String, List<String>> resHeaders = <String, List<String>>{};
      response.headers.forEach((name, values) {
        resHeaders[name] = values;
        if (data.setCookieRename && name.toLowerCase() == "set-cookie"){
          resHeaders["Set-Cookie-Renamed"] = values;
        }
      });
      result = ProxyResponseData(
        stream: response,
        contentLength: response.contentLength,
        statusCode: response.statusCode,
        headers: resHeaders
      );
    } catch (e) {
      Logger.e(_tag, "send http proxy request error: $e");
      result = ProxyResponseData();
    }
    return result;
  }
  static const String defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";
  static _setHeader(HttpClientRequest request, Map<String, dynamic>? headers) {
    headers?.forEach((key, value) {
      try {
        switch(key.toLowerCase()){
          case "useragent":
            request.headers.set("user-agent", value);
          case "contenttype":
            request.headers.set("content-type", value);
          default:
            request.headers.set(key.toLowerCase(), value);
            break;
        }
      } catch(e) {
        Logger.e(_tag, "set http proxy header error: $e");
      }
    });
    String userAgent = (request.headers.value("user-agent") ?? "").toLowerCase();
    if (userAgent.isEmpty || userAgent.startsWith("dart")){
      request.headers.set("user-agent", defaultUserAgent);
    }
  }
}