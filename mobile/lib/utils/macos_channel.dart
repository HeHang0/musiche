import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';

import '../log/logger.dart';

class MacOSChannel {
  static const _tag = "FlutterMacOSWebView";
  static const _channel = 'musiche-method-channel-macos-webview';
  static const _methodOpen = "open";
  static const _methodTheme = "theme";
  static const _methodFonts = "fonts";
  static const _methodLyricOptions = "lyric-options";
  static const _methodLyricLine = "lyric-line";
  static final MethodChannel? _methodChannel = Platform.isMacOS ? const MethodChannel(_channel) : null;
  static bool isLyricShow = false;

  static Future<void> open(String url) async {
    await _methodChannel?.invokeMethod(_methodOpen, {
      'url': url
    });
  }

  static Future<List<String>> getFonts() async {
    List<Object?>? result = await _methodChannel?.invokeMethod<List<Object?>>(_methodFonts);
    List<String> fonts = [];
    result?.forEach((element) {
      if(element != null) fonts.add(element.toString());
    });
    return fonts;
  }

  static Future<void> theme(bool dark, bool auto) async {
    await _methodChannel?.invokeMethod(_methodTheme, {
      'auto': auto,
      'dark': dark
    });
  }

  static Future<void> setLyricOptions(Map<String, dynamic> lyricOptions) async {
    if(!lyricOptions.containsKey('show')) lyricOptions['show'] = false;
    if(!lyricOptions.containsKey('title')) lyricOptions['title'] = '';
    isLyricShow = lyricOptions['show'];
    await _methodChannel?.invokeMethod(_methodLyricOptions, lyricOptions);
  }

  static Future<void> setLyricLine(String line) async {
    await _methodChannel?.invokeMethod(_methodLyricLine, {
      'line': line
    });
  }

  static void listen() async {
    _methodChannel?.setMethodCallHandler(_onMethodCall);
  }

  static Future<void> _onMethodCall(MethodCall call) async {
    switch (call.method) {
      case 'onOpen':
        Logger.i(_tag, "webview on open");
        return;
      case 'onClose':
        Logger.i(_tag, "webview on open");
        return;
      case 'onPageStarted':
        Logger.i(_tag, "webview on page start: ${call.arguments['url']}");
        return;
      case 'onLogger':
        Logger.i(_tag, "webview on console: ${call.arguments['message']}");
        return;
      case 'onPageFinished':
        Logger.i(_tag, "webview on page finished: ${call.arguments['url']}");
        return;
      case 'onWebResourceError':
        Logger.i(_tag, "webview on error, "
            "code: ${call.arguments['errorCode']}, "
            "desc: ${call.arguments['description']}, "
            "domain: ${call.arguments['domain']}, "
            "type: ${call.arguments['errorType']}");
        return;
    }
  }
}