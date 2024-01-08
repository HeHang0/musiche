import 'dart:convert';
import 'dart:io';

class ProxyResponseData {
  String data;
  String contentType;
  int statusCode;
  int contentLength;
  Map<String, List<String>>? headers;
  Stream<List<int>>? stream;

  ProxyResponseData({
    this.data = "",
    this.contentType = "",
    this.statusCode = HttpStatus.ok,
    this.contentLength = 0,
    this.headers,
    this.stream
  });

  factory ProxyResponseData.fromMap(Map<String, dynamic> data)
  {
    ProxyResponseData result = ProxyResponseData();
    result.data = jsonEncode(data);
    return result;
  }
}