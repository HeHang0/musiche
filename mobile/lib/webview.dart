import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:musiche/log/logger.dart';
import 'package:musiche/server/file_handler.dart';
import 'package:musiche/server/server_manager.dart';
import 'package:musiche/utils/android_channel.dart';
import 'package:url_launcher/url_launcher_string.dart';


class WebViewApp extends StatefulWidget {
  const WebViewApp({super.key});

  @override
  State<WebViewApp> createState() => _WebViewAppState();
}

class _WebViewAppState extends State<WebViewApp> with WidgetsBindingObserver {
  static const String _tag = "MusicWebView";
  final GlobalKey webViewKey = GlobalKey();
  static final String _url = "http://127.0.0.1:${ServerManager.port}/index.html";//kDebugMode ? "http://192.168.3.2:5173" :
  InAppWebViewController? webViewController;
  InAppWebViewSettings settings = InAppWebViewSettings(
      isInspectable: kDebugMode,
      mediaPlaybackRequiresUserGesture: false,
      allowsPictureInPictureMediaPlayback:true,
      transparentBackground: true,
      allowBackgroundAudioPlaying: false,
      disableContextMenu: true,
      supportZoom: false,
      scrollBarStyle: ScrollBarStyle.SCROLLBARS_OUTSIDE_OVERLAY
  );
  double _opacity = 0;
  Timer? _delayShow;
  @override
  void initState() {
    super.initState();
    if (!kIsWeb && Platform.isAndroid) {
      InAppWebViewController.setWebContentsDebuggingEnabled(kDebugMode);
    }
    WidgetsBinding.instance.addObserver(this);
    // Logger.i(_tag, MediaQuery.of(context).platformBrightness);
    // ServerManager.changeTheme(Theme.of(context).brightness == Brightness.dark);
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

  void _onBackClick(bool didPop) async {
    dynamic result = await webViewController?.evaluateJavascript(
        source: "Boolean(history.state.back != null || window.isPlayDetailShow())");
    bool canBack;
    if(result == null || result.runtimeType != bool) {
      canBack = (await webViewController?.canGoBack()) ?? false;
    }else {
      canBack = result;
    }
    if(canBack){
      dynamic hideResult = await webViewController?.evaluateJavascript(
          source: "window.hidePlayDetail()");
      if(hideResult == null || hideResult.runtimeType != bool || !hideResult){
        webViewController?.goBack();
      }
    }else {
      if(!kIsWeb && Platform.isAndroid) AndroidChannel.backToHome();
    }
  }

  void _showWebView(){
    if(_opacity >= 1) return;
    _setSafeArea();
    Logger.i(_tag, "set webview opacity 1");
    setState(() {
      _opacity = 1;
    });
  }

  void _setSafeArea(){
    if (!kIsWeb && Platform.isAndroid) {
      EdgeInsets safePadding = MediaQuery.of(context).padding;
      webViewController?.evaluateJavascript(source: ""
          "let safeAreaStyle = document.getElementById('safe-area-style');"
          "if(!safeAreaStyle){"
          "safeAreaStyle = document.createElement('style');"
          "safeAreaStyle.id = 'safe-area-style';"
          "if (document.head) document.head.appendChild(safeAreaStyle);"
          "else document.addEventListener('load',"
          "()=>document.head.appendChild(safeAreaStyle));}"
          "safeAreaStyle.innerHTML='"
          ":root{--safe-area-inset-top: ${safePadding.top.toInt()}px;"
          "--safe-area-inset-right: ${safePadding.right.toInt()}px;"
          "--safe-area-inset-left: ${safePadding.left.toInt()}px;"
          "--safe-area-inset-bottom: ${safePadding.bottom.toInt()}px;}';");
      Logger.i(_tag, "inject safe area inset: $safePadding");
    }
  }

  _onWebViewCreated (InAppWebViewController controller) {
    webViewController = controller;
    FileHandler.handlers.forEach((key, value) {
      webViewController?.addJavaScriptHandler(handlerName: key, callback: value);
    });
  }

  Future<NavigationActionPolicy> _shouldOverrideUrlLoading(controller, navigationAction) async {
    final uri = navigationAction.request.url;
    String urlString = uri?.toString() ?? "";
    if (urlString.isNotEmpty && !urlString.startsWith("http://${kDebugMode ? '1' : '127.0.0.1'}")) {
      if(urlString.startsWith("http")) launchUrlString(urlString, mode: LaunchMode.externalApplication);
      return NavigationActionPolicy.CANCEL;
    }
    return NavigationActionPolicy.ALLOW;
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

  Future<PermissionResponse?> _onPermissionRequest(controller, request) async {
    return PermissionResponse(
        resources: request.resources,
        action: PermissionResponseAction.GRANT);
  }
  _onReceivedError(controller, request, error) {
    Logger.e(_tag, "receive web error", error: error);
  }
  _onProgressChanged(controller, progress) {
  }
  _onConsoleMessage(controller, ConsoleMessage consoleMessage) {
    if("musiche loaded" == consoleMessage.message){// &&
      if(_opacity < 1){
        _delayShow?.cancel();
        _delayShow = Timer(const Duration(milliseconds: 100), _showWebView);
      }else {
        _setSafeArea();
      }
    }
    Logger.i(_tag, "console message: ${consoleMessage.message}");
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
        canPop: false,
        onPopInvoked : _onBackClick,
        child: Opacity(
          opacity: _opacity,
          child: InAppWebView(
            key: webViewKey,
            initialUrlRequest:
            URLRequest(url: WebUri(_url)),
            initialSettings: settings,
            onWebViewCreated: _onWebViewCreated,
            shouldOverrideUrlLoading: _shouldOverrideUrlLoading,
            onLoadStart: _onLoadStart,
            onLoadStop: _onLoadStop,
            onReceivedError: _onReceivedError,
            onProgressChanged: _onProgressChanged,
            onConsoleMessage: _onConsoleMessage,
            onPermissionRequest: _onPermissionRequest,
          ),
        )
    );
  }
}