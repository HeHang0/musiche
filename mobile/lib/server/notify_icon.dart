import 'package:tray_manager/tray_manager.dart';

import '../log/logger.dart';

class NotifyIcon with TrayListener {
  static const _tag = "NotifyIcon";

  static Future<void> show()async {
    await trayManager.setIcon('assets/logo-circle.png');
    Menu menu = Menu(
      items: [
        MenuItem(
          key: 'show_window',
          label: 'Show Window',
        ),
        MenuItem.separator(),
        MenuItem(
          key: 'exit_app',
          label: 'Exit App',
        ),
      ],
    );
    await trayManager.setContextMenu(menu);
    trayManager.addListener(NotifyIcon());
    Logger.i(_tag, "add tray success");
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    Logger.i(_tag, "onTrayMenuItemClick: ${menuItem.key}");
    if (menuItem.key == 'show_window') {
      // do something
    } else if (menuItem.key == 'exit_app') {
      // do something
    }
  }

  @override onTrayIconMouseUp(){
    Logger.i(_tag, "onTrayIconMouseUp");
    trayManager.popUpContextMenu();
  }
}