import * as http from '../utils/http';
import { StorageKey, storage } from '../utils/storage';
import { Config, ShortcutKey, ShortcutType } from '../utils/type';
import { usePlayStore } from './play';
import { useSettingStore } from './setting';
import { registerServiceWorker } from '../sw/register';
import { LyricManager } from '../utils/lyric';
import * as local from '../utils/api/local';

export class MusicConnection {
  webSocketClient?: http.CommunicationClient;
  play = usePlayStore();
  setting = useSettingStore();
  public config: Config = {
    remote: false,
    storage: false,
    file: false,
    list: false,
    lyric: false,
    client: false,
    shortcut: false,
    gpu: false
  };

  constructor() {
    this.init();
    this.registerShortcut();
  }

  async init() {
    try {
      const res = await fetch(`//${http.httpAddress}/config`);
      const remoteConfig: Config = await res.json();
      this.config.remote = Boolean(remoteConfig.remote);
      this.config.storage = Boolean(remoteConfig.storage);
      this.config.file = Boolean(remoteConfig.file);
      this.config.list = Boolean(remoteConfig.list);
      this.config.client = Boolean(remoteConfig.client);
      this.config.shortcut = Boolean(remoteConfig.shortcut);
      this.config.gpu = Boolean(remoteConfig.gpu);
      this.config.lyric = Boolean(remoteConfig.lyric);
    } catch {}

    if (!this.config.remote) registerServiceWorker();
    this.config.remote && http.setRemoteMode(true);
    this.config.storage && storage.setRemoteMode(true);
    this.config.lyric && LyricManager.setRemoteMode(true);
    this.config.file && local.setRemoteMode(true);
    const storages = await storage.getAll();
    await this.play.initValue(this.config, storages);
    await this.setting.initValue(this.config, storages);
    await import('../style/main.css');
    document.documentElement.style.opacity = '1';
    console.log('musiche loaded');
    this.webSocketClient = http.wsClient(
      this.wsMessage.bind(this),
      this.wsClose.bind(this)
    );
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
      !this.config.shortcut &&
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
          if (this.play.music.id && this.play.music.type) {
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
          if (this.play.music.id && this.play.musicList.length > 0)
            this.play.playDetailShow = true;
          break;
        case 'lover':
          if (this.play.music.type && this.play.music.type) {
            let exist =
              this.play.myLover[this.play.music.type + this.play.music.id];
            this.play.addMyLove([this.play.music], exist);
          }
          break;
      }
    } catch {}
  }
  wsClose() {
    setTimeout(() => {
      this.webSocketClient = http.wsClient(
        this.wsMessage.bind(this),
        this.wsClose.bind(this)
      );
    }, 1000);
  }
}
