import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:musiche/server/server_manager.dart';
import 'package:musiche/webview.dart';
import 'package:musiche/utils/webview_macos.dart';
import 'package:window_manager/window_manager.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await windowManager.ensureInitialized();
  await ServerManager.startServer();
  if(Platform.isMacOS) {
    MacOSChannel.open("http://127.0.0.1:${ServerManager.port}/index.html");
    MacOSChannel.listen();
  }
  runApp(const MyApp());
}



class MyApp extends StatelessWidget {
  const MyApp({super.key});
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    ServerManager.changeTheme(MediaQuery.of(context).platformBrightness == Brightness.dark);
    return MaterialApp(//WebViewApp(//)
      home: !kIsWeb && Platform.isMacOS ? null : const WebViewApp(),
      // theme: ThemeData(colorScheme: const ColorScheme.light()),
      // darkTheme: ThemeData(colorScheme: const ColorScheme.dark(background: Color.fromRGBO(19, 19, 26, 1))),
      // themeMode: ThemeMode.system,
    );
  }
}
