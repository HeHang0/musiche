import 'package:flutter/material.dart';
import 'package:musiche/server/server_manager.dart';
import 'package:musiche/webview.dart';


Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ServerManager.startServer();
  runApp(const MyApp());
}



class MyApp extends StatelessWidget {
  const MyApp({super.key});
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    ServerManager.changeTheme(MediaQuery.of(context).platformBrightness == Brightness.dark);
    return const MaterialApp(//WebViewApp(//)
      home: WebViewApp(),
      // theme: ThemeData(colorScheme: const ColorScheme.light()),
      // darkTheme: ThemeData(colorScheme: const ColorScheme.dark(background: Color.fromRGBO(19, 19, 26, 1))),
      // themeMode: ThemeMode.system,
    );
  }
}
