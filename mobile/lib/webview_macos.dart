import 'dart:async';

import 'package:flutter/material.dart';
import 'package:musiche/log/logger.dart';
import 'package:musiche/server/server_manager.dart';


class WebViewMacOSApp extends StatefulWidget {
  const WebViewMacOSApp({super.key});

  @override
  State<WebViewMacOSApp> createState() => _WebViewMacOSAppState();
}

class _WebViewMacOSAppState extends State<WebViewMacOSApp> with WidgetsBindingObserver {
  static const String _tag = "MusicWebViewMacOS";
  final GlobalKey webViewKey = GlobalKey();
  static final String _url = "http://127.0.0.1:${ServerManager.port}/index.html";//kDebugMode ? "http://192.168.3.2:5173" :
  double _opacity = 0;
  Timer? _delayShow;
  @override
  void initState() {
    super.initState();
    // WebviewWindow.create().then((value) => value.launch(_url));
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    ServerManager.changeTheme(MediaQuery.of(context).platformBrightness == Brightness.dark);
  }

  void _showWebView(){
    if(_opacity >= 1) return;
    Logger.i(_tag, "set webview opacity 1");
    setState(() {
      _opacity = 1;
    });
  }

  void _onLoadStart(controller, url) {
    _delayShow?.cancel();
    Logger.i(_tag, "on load start");
  }

  void _onLoadStop(controller, url) async {
    _delayShow?.cancel();
    _delayShow = Timer(const Duration(milliseconds: 233), _showWebView);
    Logger.i(_tag, "on load stop");
  }

  @override
  Widget build(BuildContext context) {
    return const Opacity(
      opacity: 1,
      // child: Webview(url: _url),
    );
  }
}