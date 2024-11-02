import { hilog } from '@kit.PerformanceAnalysisKit';
import { webview } from '@kit.ArkWeb';
import { ConfigurationConstant } from '@kit.AbilityKit';

@Entry
@Component
struct Index {
  TAG = "Index"
  webController: webview.WebviewController = new webview.WebviewController();
  url: string = 'http://127.0.0.1:8888';
  @State webOpacity: number = 0.01;
  @StorageProp('currentColorMode') @Watch('onColorModeChange') currentMode: number = ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT;
  @State pageColor: Resource = $r('sys.color.ohos_id_color_background');
  @State darkMode: WebDarkMode = WebDarkMode.Auto;

  onColorModeChange(): void {
    this.pageColor = this.currentMode == ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT ? $r('sys.color.ohos_id_color_background') : $r('sys.color.ohos_id_color_background_dark')
  }
  onConsole=(data: OnConsoleEvent):boolean=>{
    if(this.webOpacity < 1 && data.message.getMessage().indexOf('musiche loaded') >= 0) {
      this.webOpacity = 1
    }
    hilog.info(0x0000, Index.name, '日志： %{public}s', data.message.getMessage());
    return true
  }
  onControllerAttached=()=>{
    hilog.info(0x0000, Index.name, '日志： 当前UserAgent %{public}s', this.webController.getUserAgent());
    // try {
    //   this.webController.setCustomUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1")
    // } catch (e) {
    //   hilog.info(0x0000, Index.name, '日志： 设置出错2 %{public}s', ''+e);
    // }
  }

  aboutToAppear() {
    // 配置Web开启调试模式
    webview.WebviewController.setWebDebuggingAccess(true);
    hilog.info(0x0000, Index.name, '日志： 开启调试啊啊啊啊');
    this.onColorModeChange()
  }

  onInterceptRequest(event: OnInterceptRequestEvent): WebResourceResponse|undefined{
    hilog.info(0x0000, Index.name, '请求： ' + event.request.getRequestUrl());
		return undefined;
	}

  build() {
    RelativeContainer() {
      RelativeContainer(){
        Image($r('app.media.app_icon_circle'))
          .objectFit(ImageFit.Contain)
          .height('80%')
          .width('80%')
          .alignRules({
            center: { anchor: '__container__', align: VerticalAlign.Center },
            middle: { anchor: '__container__', align: HorizontalAlign.Center }
          })
      }
      .backgroundColor(this.pageColor)
      .height('100%')
      .width('100%')
      Web({
        src: this.url,
        controller: this.webController
      }).id(Index.name)
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .multiWindowAccess(false)
        .onConsole(this.onConsole)
        .onControllerAttached(this.onControllerAttached)
        .onInterceptRequest(this.onInterceptRequest)
        .opacity(this.webOpacity)
        .darkMode(this.darkMode)
        .backgroundColor($r('sys.color.ohos_id_color_background_transparent'))
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
    }
    .height('100%')
    .width('100%')
  }
}