import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:musiche/log/logger.dart';

class Network {
  static final String _tag = "MusicheNetwork";
  static Future<int> findAvailablePort({int port = 8080}) async {
    for(;port < 65535;port++) {
      try {
        ServerSocket serverSocket = await ServerSocket.bind('localhost', port);
        await serverSocket.close();
        break;
      } catch (e) {
        Logger.e(_tag, 'Port $port is not available. Trying another port\n$e');
      }
    }
    return port;
  }

  static void processCors(HttpResponse response)
  {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Headers", "*");
    response.headers.set("Access-Control-Allow-Methods", "*");
    response.headers.set("Access-Control-Expose-Headers", "*");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // static Future<Uint8List?> downloadByteArray(String url) async {
  //   final http.Response response = await http.get(Uri.parse(url));
  //   if (response.statusCode == 200) {
  //     return response.bodyBytes;
  //   } else {
  //     return null;
  //   }
  // }
}