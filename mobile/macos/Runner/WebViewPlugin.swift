//
//  WebViewPlugin.swift
//  Runner
//
//  Created by 何航 on 2024/3/20.
//

import Cocoa
import FlutterMacOS
import WebKit

public class WebViewPlugin: NSObject, FlutterPlugin {
  private let channel: FlutterMethodChannel
  private let registrar: FlutterPluginRegistrar
  private let webview: WKWebView
  private var lyricWindow: LyricWindow?
  private let fonts: [String]

  required init(channel: FlutterMethodChannel, registrar: FlutterPluginRegistrar) {
    self.channel = channel
    self.registrar = registrar
    self.webview = WKWebView()
    self.fonts = NSFontManager().availableFontFamilies
    super.init()
    initBackground();
    showLogo()
    addWebview()
    showDragView()
  }

  func initBackground(){
    let dark = UserDefaults.standard.bool(forKey: "dark");
    let auto = UserDefaults.standard.bool(forKey: "auto");
    var backgroundColor: NSColor
    let systemAppearance = NSApp.effectiveAppearance;
    if (auto && systemAppearance.name == .darkAqua) || dark {
      backgroundColor = NSColor.black
    } else {
      backgroundColor = NSColor.white
    }
    self.registrar.view!.wantsLayer = true
    self.registrar.view!.layer?.backgroundColor = backgroundColor.cgColor
  }
  
  func addWebview(){
    self.webview.configuration.preferences.javaEnabled = true
    self.webview.navigationDelegate = self
    self.webview.translatesAutoresizingMaskIntoConstraints = false
    self.webview.configuration.userContentController.add(self, name: "logger")
    self.webview.configuration.allowsAirPlayForMediaPlayback = true
    self.webview.setValue(true, forKey: "drawsTransparentBackground")
    if #available(macOS 13.3, *) {
      self.webview.isInspectable = true
    }
    self.registrar.view!.addSubview(self.webview)
    NSLayoutConstraint.activate([
        self.webview.topAnchor.constraint(equalTo: registrar.view!.topAnchor),
        self.webview.leadingAnchor.constraint(equalTo: registrar.view!.leadingAnchor),
        self.webview.trailingAnchor.constraint(equalTo: registrar.view!.trailingAnchor),
        self.webview.bottomAnchor.constraint(equalTo: registrar.view!.bottomAnchor)
    ])
    let script = WKUserScript(source: "document.body.oncontextmenu=e=>e.preventDefault();console.log = function(){let result='';for(let i=0;i<arguments.length;i++){result+=arguments[i]+' '};result=result.trim();result && window.webkit.messageHandlers['logger'].postMessage(result)}", injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    self.webview.configuration.userContentController.addUserScript(script)
  }
  
  func showDragView(){
    let viewBarHeight: CGFloat = 22.0
    let view = DraggableView()
    view.wantsLayer = true
    view.translatesAutoresizingMaskIntoConstraints = false
    registrar.view!.addSubview(view)
    NSLayoutConstraint.activate([
        view.topAnchor.constraint(equalTo: registrar.view!.topAnchor),
        view.leadingAnchor.constraint(equalTo: registrar.view!.leadingAnchor),
        view.trailingAnchor.constraint(equalTo: registrar.view!.trailingAnchor),
        view.heightAnchor.constraint(equalToConstant: viewBarHeight)
    ])
  }
  
  func showLogo(){
    guard let appIcon = NSApp.applicationIconImage else {
        return
    }
    
    if(registrar.view == nil) {
        return
    }

    let imageView = NSImageView(image: appIcon)
    imageView.translatesAutoresizingMaskIntoConstraints = false
    self.registrar.view!.addSubview(imageView)

    NSLayoutConstraint.activate([
        imageView.centerXAnchor.constraint(equalTo: self.registrar.view!.centerXAnchor),
        imageView.centerYAnchor.constraint(equalTo: self.registrar.view!.centerYAnchor)
    ])
  }
  
  public static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
        name: "musiche-method-channel-macos-webview",
        binaryMessenger: registrar.messenger
    )
    let instance = WebViewPlugin(channel: channel, registrar: registrar)
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch(call.method){
      case "open": open(call: call, result: result); break;
      case "show": show(call: call, result: result); break;
      case "hide": show(call: call, result: result); break;
      case "theme": theme(call: call, result: result); break;
      case "fonts": result(self.fonts); break;
      case "lyric-options": setLyricOptions(call: call, result: result); break;
      case "lyric-line": setLyricLine(call: call, result: result); break;
      default: break;
    }
  }
  private func setLyricLine(call: FlutterMethodCall, result: @escaping FlutterResult){
    let args = call.arguments as! [String: Any]
    let line = args["line"] as! String
    self.lyricWindow?.setLyric(text: line)
    result(nil)
  }
  private func setLyricOptions(call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as! [String: Any]
    let show = (args["show"] as? Bool) ?? false
    if(!show) {
      self.lyricWindow?.close()
      result(nil)
      return
    }
    if(self.lyricWindow == nil) {
      let title = (args["title"] as? String) ?? ""
      self.lyricWindow = LyricWindow(title: title)
      self.lyricWindow?.isReleasedWhenClosed = false
      let dark = UserDefaults.standard.bool(forKey: "dark");
      let auto = UserDefaults.standard.bool(forKey: "auto");
      self.lyricWindow?.setTheme(dark: (auto && NSApp.effectiveAppearance.name == .darkAqua) || dark)
    }
    
    let fontSize = (args["fontSize"] as? Int) ?? 22
    let fontFamily = args["fontFamily"] as? String
    let fontBold = (args["fontBold"] as? Bool) ?? false
    let effectColor = args["effectColor"] as? String
    let fontColor = args["fontColor"] as? String
    self.lyricWindow?.setOptions(fontFamily: fontFamily, fontSize: CGFloat(fontSize), fontBold: fontBold, effectColor: effectColor, fontColor: fontColor)
    self.lyricWindow?.orderFront(self)
    result(nil)
  }
  private func theme(call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as! [String: Any]
    let auto = args["auto"] as! Bool
    let dark = args["dark"] as! Bool
    UserDefaults.standard.setValue(auto, forKey: "auto")
    UserDefaults.standard.setValue(dark, forKey: "dark")
    self.lyricWindow?.setTheme(dark: dark)
    result(nil)
  }
  private func show(call: FlutterMethodCall, result: @escaping FlutterResult) {
    self.registrar.view?.window?.makeKeyAndOrderFront(nil)
    result(nil)
  }
  private func hide(call: FlutterMethodCall, result: @escaping FlutterResult) {
    self.registrar.view?.window?.orderOut(nil)
    result(nil)
  }
  
  private func open(call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as! [String: Any]
    if let url = URL(string: args["url"] as! String) {
        let request = URLRequest(url: url)
        webview.load(request)
    }
    result(nil)
  }
}

public class LyricWindow: NSWindow {
  private let lyricLabel: NSTextField
  private var dark: Bool = false
  
  public init(title: String){
    self.lyricLabel = NSTextField(labelWithString: title)
    super.init(contentRect: NSRect(x: 0, y: 0, width: 500, height: 100), styleMask: [.fullSizeContentView, .borderless, .resizable], backing: .buffered, defer: true)
    setWindowPos()
    setWindowProperty()
    setContentView()
    setLyricLabel()
  }
  public func setTheme(dark: Bool){
    self.dark = dark
    let color = dark ? NSColor.white : NSColor.black;
    self.contentView?.layer?.backgroundColor = color.withAlphaComponent(0.1).cgColor
  }
  public func setOptions(fontFamily: String?, fontSize: CGFloat, fontBold: Bool, effectColor: String?, fontColor: String?){
    var font: NSFont? = nil
    if(fontFamily != nil && !fontFamily!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
      font = NSFont(name: fontFamily!, size: fontSize)
    }
    if(font == nil){
      font = NSFont.systemFont(ofSize: fontSize, weight: fontBold ? .bold : .regular)
    }
    self.lyricLabel.textColor = getColorFromString(hex: fontColor, defaultColor: dark ? NSColor.white : NSColor.black)
    var shadow: NSShadow? = nil
    shadow = NSShadow()
    let shadowColor = getColorFromString(hex: effectColor, defaultColor: NSColor.clear)
    shadow!.shadowColor = shadowColor
    shadow!.shadowBlurRadius = 3
    self.lyricLabel.shadow = shadow
    self.lyricLabel.font = font
    self.minSize.height = Double(fontSize)
  }
  func getColorFromString(hex: String?, defaultColor: NSColor=NSColor.clear) -> NSColor
  {
    if(hex == nil || hex!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
      return defaultColor
    }
    let trimHex = hex!.trimmingCharacters(in: .whitespacesAndNewlines)
    let dropHash = String(trimHex.dropFirst()).trimmingCharacters(in: .whitespacesAndNewlines)
    let hexString = trimHex.starts(with: "#") ? dropHash : trimHex
    let ui64 = UInt64(hexString, radix: 16)
    let value = ui64 != nil ? Int(ui64!) : 0
    return NSColor(red: CGFloat((value >> 16) & 0xff) / 255, green: CGFloat((value >> 08) & 0xff) / 255, blue: CGFloat((value >> 00) & 0xff) / 255, alpha: 1)
  }
  public func setLyric(text: String){
    self.lyricLabel.stringValue = text
  }
  private func setWindowPos(){
    self.minSize.width = 200
    self.minSize.height = 22
    let maxWidth = NSScreen.main?.visibleFrame.width ?? 1000
    let maxHeight = NSScreen.main?.visibleFrame.height ?? 1000
    self.maxSize.width = maxWidth
    self.maxSize.height = maxHeight
    var x = UserDefaults.standard.double(forKey: "lyric-x")
    var y = UserDefaults.standard.double(forKey: "lyric-y")
    var w = UserDefaults.standard.double(forKey: "lyric-w")
    var h = UserDefaults.standard.double(forKey: "lyric-h")
    if(w < self.minSize.width) {
      w = self.minSize.width
    }else if(w > self.maxSize.width){
      w = self.maxSize.width
    }
    if(h < self.minSize.height) {
      h = self.minSize.height
    }else if(h > self.maxSize.height){
      h = self.maxSize.height
    }
    if(x < 0) {
      x = 0
    }else if(x > maxWidth - w){
      x = maxWidth - w
    }
    if(y < 0) {
      y = 0
    }else if(y > maxHeight - h){
      y = maxHeight - h
    }
    self.setContentSize(NSSize(width: w, height: h))
    self.setFrameOrigin(NSPoint(x: x, y: y))
  }
  private func setWindowProperty(){
    self.isOpaque = false
    self.level = .floating
    if #available(macOS 13.0, *) {
      self.collectionBehavior = [.canJoinAllSpaces, .canJoinAllApplications, .fullScreenAuxiliary]
    } else {
      self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    }
    self.isMovable = true
    self.backgroundColor = NSColor.clear
  }
  private func setContentView(){
    self.contentView!.wantsLayer = true
    self.contentView!.layer?.masksToBounds = true
    self.contentView!.layer?.cornerRadius = 8.0
    self.contentView!.layer?.masksToBounds = true
    //    self.contentView!.layer?.backgroundColor = NSColor.systemPink.cgColor
  }
  private func setLyricLabel(){
    if(self.contentView == nil) {
      return
    }
    self.lyricLabel.isEditable = false
    self.lyricLabel.isSelectable = false
    self.lyricLabel.isBezeled = false
    self.lyricLabel.isBordered = false
    
    self.lyricLabel.alignment = .center
    self.lyricLabel.backgroundColor = .clear
    self.lyricLabel.drawsBackground = false
    self.contentView!.addSubview(self.lyricLabel)
    self.lyricLabel.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      self.lyricLabel.centerXAnchor.constraint(equalTo: self.contentView!.centerXAnchor),
      self.lyricLabel.centerYAnchor.constraint(equalTo: self.contentView!.centerYAnchor)
    ])
  }
  public override func mouseDown(with event: NSEvent) {
  }
  public override func mouseDragged(with event: NSEvent) {
    self.performDrag(with: event)
  }
  public override func mouseUp(with event: NSEvent) {
    UserDefaults.standard.setValue(self.frame.origin.x, forKey: "lyric-x")
    UserDefaults.standard.setValue(self.frame.origin.y, forKey: "lyric-y")
    UserDefaults.standard.setValue(self.frame.size.width, forKey: "lyric-w")
    UserDefaults.standard.setValue(self.frame.size.height, forKey: "lyric-h")
  }
}
extension WebViewPlugin: WKScriptMessageHandler {
public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage){
    if message.name == "logger" {
        let body = message.body as! String
        channel.invokeMethod("onLogger", arguments: [ "message": body ])
    }
  }
}
class DraggableView: NSView {
  override func mouseDown(with event: NSEvent) {
  }
  override func mouseDragged(with event: NSEvent) {
    self.window?.performDrag(with: event)
  }
  override func mouseUp(with event: NSEvent) {
    if event.clickCount != 2 { return }
    if (self.window?.styleMask.contains(.fullScreen) ?? false) { return }
    self.window?.zoom(nil)
  }
}

extension WebViewPlugin: WKNavigationDelegate {
  public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
      guard let url = webView.url?.absoluteString else { return }
      channel.invokeMethod("onPageStarted", arguments: [ "url": url ])
  }

  public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard let url = webView.url?.absoluteString else { return }
    channel.invokeMethod("onPageFinished", arguments: [ "url": url ])
  }
  
  public func webView(_ webView: WKWebView, did navigation: WKNavigation!) {
      guard let url = webView.url?.absoluteString else { return }
      channel.invokeMethod("onPageFinished", arguments: [ "url": url ])
  }

  public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
      let error = NSError(
          domain: WKError.errorDomain,
          code: WKError.webContentProcessTerminated.rawValue,
          userInfo: nil
      )
      onWebResourceError(error)
  }

  public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
      onWebResourceError(error as NSError)
  }

  public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
      onWebResourceError(error as NSError)
  }

  static func errorCodeToString(code: Int) -> String? {
      switch code {
          case WKError.unknown.rawValue:
              return "unknown";
          case WKError.webContentProcessTerminated.rawValue:
              return "webContentProcessTerminated";
          case WKError.webViewInvalidated.rawValue:
              return "webViewInvalidated";
          case WKError.javaScriptExceptionOccurred.rawValue:
              return "javaScriptExceptionOccurred";
          case WKError.javaScriptResultTypeIsUnsupported.rawValue:
              return "javaScriptResultTypeIsUnsupported";
          default:
              return nil;
      }

  }

  public func onWebResourceError(_ error: NSError) {
      channel.invokeMethod("onWebResourceError", arguments: [
          "errorCode": error.code,
          "domain": error.domain,
          "description": error.description,
          "errorType": WebViewPlugin.errorCodeToString(code: error.code) as Any
      ])
  }
}
