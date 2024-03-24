import Cocoa
import FlutterMacOS

@NSApplicationMain
class AppDelegate: FlutterAppDelegate {
  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    return false
  }
  override func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    // 用户点击了 Dock 图标来显示所有窗口
    for window in NSApplication.shared.windows {
      if window.level != .floating {
        window.makeKeyAndOrderFront(nil)
      }
    }
    return true
  }
}
