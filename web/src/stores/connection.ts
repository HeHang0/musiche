import { watch } from 'vue';
import {
  CommunicationClient,
  wsClient,
  musicOperate,
  setRemoteMode
} from '../utils/http';
import { StorageKey, storage } from '../utils/storage';
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
    watch(() => this.setting.autoAppTheme, this.autoAppThemeChange.bind(this));
  }

  autoAppThemeChange() {
    if (this.setting.autoAppTheme) {
      this.sendWsMessage('/dark');
    }
  }

  async init(_interval: boolean) {
    let remoteMode = false;
    try {
      const config = await musicOperate('/config');
      remoteMode = Boolean(config.remote);
    } catch {}
    setRemoteMode(remoteMode);
    storage.setRemoteMode(remoteMode);
    await this.play.initValue(remoteMode);
    await this.setting.initValue(remoteMode);
    this.webSocketClient = wsClient(
      this.wsMessage.bind(this),
      this.wsClose.bind(this),
      this.autoAppThemeChange.bind(this)
    );
    // if (interval) {
    //   setInterval(this.sendWsStatus.bind(this), 500);
    // }
    if (this.setting.pageValue.savePlayProgress) {
      try {
        const progress = parseInt(
          localStorage.getItem(StorageKey.Progress) || '0'
        );
        if (progress > 0 && progress < 1000) {
          this.play.changeProgress(progress);
        }
      } catch {}
    }
    if (this.setting.pageValue.playAtRun) {
      this.play.play();
    }
  }

  registerShortcut() {
    document.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  onKeyUp(event: KeyboardEvent) {
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
        case 'lover':
          if (this.play.music.type && this.play.music.type) {
            let exist =
              this.play.myLover[this.play.music.type + this.play.music.id];
            this.play.addMyLove([this.play.music], exist);
          }
          break;
      }
    }
  }

  sendWsMessage(message: string) {
    if (!this.webSocketClient) return;
    this.webSocketClient.readyState == WebSocket.OPEN &&
      this.webSocketClient.send(message);
  }

  sendWsStatus() {
    if (this.play.checkingStatus) return;
    this.sendWsMessage('/status\n');
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
        case 'lyric':
          this.play.showDesktopLyric(Boolean(result.data));
          break;
        case 'show':
          this.play.playDetailShow = true;
          break;
        case 'lover':
          if (this.play.music.type && this.play.music.type) {
            let exist =
              this.play.myLover[this.play.music.type + this.play.music.id];
            this.play.addMyLove([this.play.music], exist);
          }
          break;
        case 'dark':
          this.setting.updateDarkMode(Boolean(result.data));
          break;
      }
    } catch {}
  }
  wsClose() {
    setTimeout(() => {
      this.webSocketClient = wsClient(
        this.wsMessage.bind(this),
        this.wsClose.bind(this),
        this.autoAppThemeChange.bind(this)
      );
    }, 1000);
  }
}
