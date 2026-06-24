import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:musiche/server/server_manager.dart';
import 'package:musiche/webview.dart';
import 'package:musiche/utils/macos_channel.dart';
import 'package:musiche/utils/os_version.dart';
import 'package:musiche/server_status_page.dart';
import 'package:window_manager/window_manager.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ServerManager.startServer();
  if(Platform.isMacOS) {
    await windowManager.ensureInitialized();
    MacOSChannel.open("http://127.0.0.1:${kDebugMode ? 5173 : ServerManager.port}");
    MacOSChannel.listen();
  }

  bool isOldAndroid = false;
  if (!kIsWeb && Platform.isAndroid) {
    try {
      final androidInfo = await OSVersion.androidInfo;
      if (androidInfo != null && androidInfo.version.sdkInt <= 23) {
        isOldAndroid = true;
      }
    } catch (e) {
      // 忽略异常
    }
  }

  runApp(MyApp(isOldAndroid: isOldAndroid));
}



class MyApp extends StatelessWidget {
  final bool isOldAndroid;
  const MyApp({super.key, this.isOldAndroid = false});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    Widget? homeWidget;
    if (!kIsWeb && Platform.isMacOS) {
      homeWidget = null;
    } else if (isOldAndroid) {
      homeWidget = const ServerStatusPage();
    } else {
      homeWidget = const WebViewApp();
    }

    return MaterialApp(
      home: homeWidget,
    );
  }
}
