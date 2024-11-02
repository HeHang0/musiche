import { AbilityConstant, Configuration, ConfigurationConstant, UIAbility, Want, wantAgent } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { HttpServer } from '../server/HttpServer';
import { AudioPlayer } from '../audio/AudioPlayer';

export default class EntryAbility extends UIAbility {
  server?: HttpServer;
  audioPlayer?: AudioPlayer;
  windowStage?: window.WindowStage
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onCreate');
    this.audioPlayer = new AudioPlayer(this.context, this.getShowWantAgentInfo(want))
    this.server = new HttpServer(this.context, this.audioPlayer)
    this.server.setOnThemeChanged(this.onThemeChanged)
    this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onNewWant');
    want.action === (want.bundleName + 'show') && this.audioPlayer?.show()
  }

  getShowWantAgentInfo(want: Want): wantAgent.WantAgentInfo{
    return {
      wants: [
        {
          bundleName: want.bundleName,
          abilityName: want.abilityName,
          action: want.bundleName + 'show'
        }
      ],
      actionType: wantAgent.OperationType.START_ABILITY,
      requestCode: 0,
      wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG]
    }
  }

  onDestroy(): void {
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onDestroy');
  }

  onThemeChanged = (colorMode: ConfigurationConstant.ColorMode) => {
    if(colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET) {
      return
    }
    if(!this.windowStage) {
      return
    }
    const windowClass: window.Window = this.windowStage.getMainWindowSync();
    if(!windowClass) {
      return
    }
    const light = colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT
    const color = light ? '#000000' : '#FFFFFF'
    windowClass.setWindowSystemBarProperties({
      isStatusBarLightIcon: light,
      statusBarContentColor: color,
      isNavigationBarLightIcon: light,
      navigationBarContentColor: color
    })
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    this.windowStage = windowStage
    // Main window is created, set main page for this ability
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onWindowStageCreate');
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, 'testTag', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err) ?? '');
        return;
      }
      const windowClass: window.Window = windowStage.getMainWindowSync(); // 获取应用主窗口
      windowClass.setWindowBackgroundColor('#00000000')
      windowClass.setWindowSystemBarEnable(['status', 'navigation'])
      // 1. 设置窗口全屏
      let isLayoutFullScreen = true;
      windowClass.setWindowLayoutFullScreen(isLayoutFullScreen)
    });
  }

  onWindowStageDestroy(): void {
    this.windowStage = void 0
    // Main window is destroyed, release UI related resources
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onWindowStageDestroy');
  }

  onConfigurationUpdate(newConfig: Configuration): void {
    AppStorage.setOrCreate('currentColorMode', newConfig.colorMode);
  }

  onForeground(): void {
    // Ability has brought to foreground
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onForeground');
  }

  onBackground(): void {
    // Ability has back to background
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onBackground');
  }
}
