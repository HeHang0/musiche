import { CommunicationClient, wsClient } from '../utils/http';
import { ShortcutKey, ShortcutType } from '../utils/type';
import { webView2Services } from '../utils/utils';
import { usePlayStore } from './play';
import { useSettingStore } from './setting';

export class MusicConnection {
  webSocketClient?: CommunicationClient;
  play = usePlayStore();
  setting = useSettingStore();

  constructor(interval: boolean) {
    this.init(interval);
    this.registerShortcut();
  }

  async init(interval: boolean) {
    await this.play.initValue();
    await this.setting.initValue();
    this.webSocketClient = wsClient(
      this.wsMessage.bind(this),
      this.wsClose.bind(this)
    );
    if (interval) {
      setInterval(this.sendWsStatus.bind(this), 500);
    }
    if (this.setting.pageValue.playAtRun) {
      this.play.play();
    }
  }

  registerShortcut() {
    document.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  onKeyUp(event: KeyboardEvent) {
    console.log('keyup', event);
    const target = event.target as HTMLElement;
    if (target?.tagName == 'INPUT' || target?.tagName == 'TEXTAREA') return;
    if (
      !webView2Services.enabled &&
      this.setting.pageValue.systemMediaShortcutUsed
    ) {
      switch (event.key) {
        case 'MediaPlayPause':
          if (this.play.playStatus.playing) this.play.pause();
          else this.play.play();
          return;
        case 'MediaTrackPrevious':
          this.play.last();
          return;
        case 'MediaTrackNext':
          this.play.next();
          return;
        case 'MediaStop':
          this.play.pause();
          return;
        // case 'AudioVolumeMute':
        // case 'AudioVolumeUp':
        // case 'AudioVolumeDown':
      }
    }
    const shortcutTypes = Object.keys(this.setting.pageValue.shortcut);
    for (let i = 0; i < shortcutTypes.length; i++) {
      const shortcut = (this.setting.pageValue.shortcut as any)[
        shortcutTypes[i]
      ] as ShortcutKey;
      if (shortcut.ctrlKey && !event.ctrlKey) continue;
      if (shortcut.shiftKey && !event.shiftKey) continue;
      if (shortcut.altKey && !event.altKey) continue;
      if (shortcut.metaKey && !event.metaKey) continue;
      if (shortcut.key !== event.code) continue;
      switch (shortcutTypes[i] as ShortcutType) {
        case 'play':
          if (this.play.playStatus.playing) this.play.pause();
          else this.play.play();
          break;
        case 'last':
          this.play.last();
          break;
        case 'next':
          this.play.next();
          break;
        case 'plus':
          this.play.changeVolume(this.play.playStatus.volume + 10);
          break;
        case 'minus':
          this.play.changeVolume(this.play.playStatus.volume - 10);
          break;
        case 'love':
          this.play.addMyLove([this.play.music]);
          break;
      }
    }
  }

  sendWsStatus() {
    if (this.play.checkingStatus || !this.webSocketClient) return;
    this.webSocketClient.readyState == WebSocket.OPEN &&
      this.webSocketClient.send('/status\n');
  }

  wsMessage(result: any) {
    if (!result) return;
    try {
      switch (result.type) {
        case 'status':
          this.play.setStatus(result.data);
          break;
        case 'maximized':
          this.setting.setMaximized(result.data);
          break;
        case 'playOrPause':
          if (this.play.playStatus.playing) this.play.pause();
          else this.play.play();
          break;
        case 'play':
          this.play.play();
          break;
        case 'pause':
          this.play.pause();
          break;
        case 'next':
          this.play.next(result.data);
          break;
        case 'last':
          this.play.last();
          break;
        case 'loop':
          this.play.setSortType(result.data);
          break;
      }
    } catch {}
  }

  wsClose() {
    setTimeout(() => {
      this.webSocketClient = wsClient(this.wsMessage, this.wsClose);
    }, 1000);
  }
}
