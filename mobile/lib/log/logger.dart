import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart' as logger;
import 'package:logger/logger.dart';

class Logger{
  static final logger.Logger _logger = logger.Logger(printer: _Printer());

  static void i(String tag, dynamic message){
    _log(tag, logger.Level.info, message);
  }
  static void e(String tag, dynamic message, {Object? error, StackTrace? stackTrace}){
    _log(tag, logger.Level.error, message, error: error, stackTrace: stackTrace);
  }
  static void w(String tag, dynamic message){
    _log(tag, logger.Level.warning, message);
  }
  static void d(String tag, dynamic message){
    _log(tag, logger.Level.debug, message);
  }
  static void _log(
      String tag,
      logger.Level level,
      dynamic message, {
        Object? error,
        StackTrace? stackTrace,
      }){

    Map<String, dynamic> messageWithTag = {
      "tag": tag,
      "message": message
    };
    _logger.log(level, messageWithTag, error: error, stackTrace: stackTrace);
  }
}

class _Printer extends logger.LogPrinter {
  @override
  List<String> log(logger.LogEvent event) {
    List<String> formatted = [];
    if(event.message is Map<String, dynamic>){
      String level = _defaultLevelText[event.level] ?? _defaultLevelText[Level.info]!;
      if(kDebugMode){
        AnsiColor color = _defaultLevelColors[event.level] ?? _defaultLevelColors[Level.info]!;
        String message = "[${getTime(DateTime.now())}] [$level] [${event.message["tag"]}] ${event.message["message"]}";
        if(event.error != null) message += ": ${event.error}";
        formatted.add(color(message));
      }else {
        String message = "[$level] [${event.message["tag"]}] ${event.message["message"]}";
        formatted.add(message);
      }
    }
    return formatted;
  }
  static final Map<Level, AnsiColor> _defaultLevelColors = {
    Level.trace: AnsiColor.fg(AnsiColor.grey(0.5)),
    Level.debug: const AnsiColor.none(),
    Level.info: const AnsiColor.fg(12),
    Level.warning: const AnsiColor.fg(208),
    Level.error: const AnsiColor.fg(196),
    Level.fatal: const AnsiColor.fg(199),
  };
  static final Map<Level, String> _defaultLevelText = {
    Level.trace:"Trace",
    Level.debug: "Debug",
    Level.info: "Info",
    Level.warning: "Warn",
    Level.error: "Error",
    Level.fatal: "Fatal",
  };

  String getTime(DateTime time) {
    String threeDigits(int n) {
      if (n >= 100) return '$n';
      if (n >= 10) return '0$n';
      return '00$n';
    }

    String twoDigits(int n) {
      if (n >= 10) return '$n';
      return '0$n';
    }

    var now = time;
    var h = twoDigits(now.hour);
    var min = twoDigits(now.minute);
    var sec = twoDigits(now.second);
    var ms = threeDigits(now.millisecond);
    return '$h:$min:$sec.$ms';
  }
}