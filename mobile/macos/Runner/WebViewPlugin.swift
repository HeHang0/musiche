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

  required init(channel: FlutterMethodChannel, registrar: FlutterPluginRegistrar) {
    self.channel = channel
    self.registrar = registrar
    self.webview = WKWebView()
    super.init()
    if(registrar.view == nil) {
        return
    }
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
    self.webview.isHidden = true
    self.registrar.view!.addSubview(self.webview)
    NSLayoutConstraint.activate([
        self.webview.topAnchor.constraint(equalTo: registrar.view!.topAnchor),
        self.webview.leadingAnchor.constraint(equalTo: registrar.view!.leadingAnchor),
        self.webview.trailingAnchor.constraint(equalTo: registrar.view!.trailingAnchor),
        self.webview.bottomAnchor.constraint(equalTo: registrar.view!.bottomAnchor),
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
        view.heightAnchor.constraint(equalToConstant: viewBarHeight),
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
        default: break;
    }
  }
  private func theme(call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as! [String: Any]
    let auto = args["auto"] as! Bool
    let dark = args["dark"] as! Bool
    UserDefaults.standard.setValue(auto, forKey: "auto")
    UserDefaults.standard.setValue(dark, forKey: "dark")
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

extension WebViewPlugin: WKScriptMessageHandler {
public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage){
    if message.name == "logger" {
        let body = message.body as! String
//        if(body == "musiche loaded"){
//            webview.isHidden = false
//        }
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
    if(self.window?.styleMask.contains(.fullScreen) ?? false) { return }
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
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
      webView.isHidden = false
    }
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
