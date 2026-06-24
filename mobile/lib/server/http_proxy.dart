import 'dart:io';

import '../log/logger.dart';
import 'proxy_request_data.dart';
import 'proxy_response_data.dart';

class HttpProxy {
  static const String _tag = 'MusicheHttpProxy';
  static Future<ProxyResponseData> request(ProxyRequestData data) async {
    var httpClient = HttpClient();
    httpClient.badCertificateCallback = (cert, host, port) => true;
    ProxyResponseData result;
    if (data.httpProxy.isNotEmpty) {
      String proxy = data.httpProxy.trim();
      if (proxy.startsWith('"') && proxy.endsWith('"')) {
        proxy = proxy.substring(1, proxy.length - 1);
      }
      if (proxy.startsWith("http://")) {
        proxy = proxy.substring(7);
      } else if (proxy.startsWith("https://")) {
        proxy = proxy.substring(8);
      }
      httpClient.findProxy = (uri) => "PROXY $proxy";
      Logger.i(_tag, "正在使用代理: $proxy 进行请求");
    }
    try {
      httpClient.autoUncompress = false;
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
          resHeaders["Set-Cookie-Renamed"] = [values.map((s) => s.replaceAll(',', '')).join(',')];
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
      result = ProxyResponseData(
        statusCode: HttpStatus.badGateway,
        data: "Proxy Error: $e",
        contentType: "text/plain; charset=utf-8"
      );
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