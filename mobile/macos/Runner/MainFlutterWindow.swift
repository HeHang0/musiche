import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    self.styleMask = [.fullSizeContentView, .titled, .closable, .miniaturizable, .resizable]
    self.titlebarAppearsTransparent = true
    self.titleVisibility = .hidden
    self.minSize.width = 1055
    self.minSize.height = 750
    let flutterViewController = FlutterViewController()
    if(self.frame.width < self.minSize.width || self.frame.height < self.minSize.height){
      setContentSize(NSSize(
        width: self.frame.width < self.minSize.width ? self.minSize.width : self.frame.width,
        height: self.frame.height < self.minSize.height ? self.minSize.height : self.frame.height
      ))
    }
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)
    RegisterGeneratedPlugins(registry: flutterViewController)
    WebViewPlugin.register(with: flutterViewController.registrar(forPlugin: "WebViewPlugin"))
    super.awakeFromNib()
  }
}
