import { defineStore } from 'pinia';
import { ElMessage } from 'element-plus';
import { httpAddress, musicOperate, updateTheme } from '../utils/http';
import {
  CloseType,
  ShortcutType,
  ShortcutKey,
  MusicType,
  UserInfo,
  DirectoryInfo,
  AppTheme,
  MusicQuality,
  LyricOptionsKey,
  RemoteClient
} from '../utils/type';
import { StorageKey, storage } from '../utils/storage';
import * as api from '../utils/api/api';
import {
  clearArray,
  dataURLtoBlob,
  isAndroid,
  isInStandaloneMode,
  isIOS,
  isWindows,
  messageOption,
  webView2Services
} from '../utils/utils';
import { LyricManager } from '../utils/lyric';
const controlKeys = [
  'ctrl',
  'control',
  'shift',
  'alt',
  'meta',
  'controlleft',
  'shiftleft',
  'altleft',
  'metaleft',
  'controlright',
  'shiftright',
  'altright',
  'metaright'
];
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeColor: HTMLMetaElement | null = document.querySelector(
  'meta[name="theme-color"]'
);
export const useSettingStore = defineStore('setting', {
  state: () => ({
    maximized: false,
    fonts: null as string[] | null,
    currentMusicType: 'cloud' as MusicType,
    currentMusicTypeShow: true,
    localDirectories: [] as DirectoryInfo[],
    autoAppTheme: false,
    playQuality: 'SQ' as MusicQuality,
    downloadQuality: 'ZQ' as MusicQuality,
    remoteMode: false,
    appTheme: {
      id: isInStandaloneMode && isIOS ? 'dark' : ''
    } as AppTheme,
    customTheme: {
      id: 'custom ',
      name: '自定义'
    } as AppTheme,
    pageValue: {
      closeType: CloseType.Hide,
      closeTypeNoRemind: false,
      font: '' as string,
      fontBold: false,
      startup: false,
      fadeIn: true,
      gpuAcceleration: true,
      disableAnimation: false,
      playAtRun: false,
      savePlayProgress: false,
      onlyAddMusicListAtDbClick: false,
      globalShortcutUsed: false,
      systemMediaShortcutUsed: false,
      lyric: {
        topmost: true,
        fontFamily: '',
        fontSize: 22,
        fontBold: true,
        effect: true,
        effectColor: '#cb7474',
        fontColor: '#ffb0b0'
      } as Record<LyricOptionsKey, any>,
      shortcut: {
        play: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: 'KeyP'
        },
        last: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: 'ArrowLeft'
        },
        next: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: 'ArrowRight'
        },
        plus: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: 'ArrowUp'
        },
        minus: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: 'ArrowDown'
        },
        love: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: 'KeyL'
        }
      } as Record<ShortcutType, ShortcutKey>,
      shortcutText: {
        play: 'Ctrl + P',
        last: 'Ctrl + Left',
        next: 'Ctrl + Right',
        plus: 'Ctrl + Up',
        minus: 'Ctrl + Down',
        love: 'Ctrl + L'
      } as Record<ShortcutType, string>,
      globalShortcut: {
        play: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: 'KeyP'
        },
        last: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: 'ArrowLeft'
        },
        next: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: 'ArrowRight'
        },
        plus: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: 'ArrowUp'
        },
        minus: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: 'ArrowDown'
        },
        love: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: 'KeyL'
        }
      } as Record<ShortcutType, ShortcutKey>,
      globalShortcutText: {
        play: 'Ctrl + Shift + P',
        last: 'Ctrl + Shift + Left',
        next: 'Ctrl + Shift + Right',
        plus: 'Ctrl + Shift + Up',
        minus: 'Ctrl + Shift + Down',
        love: 'Ctrl + Shift + L'
      } as Record<ShortcutType, string>
    },
    userInfo: {
      cloud: {
        id: '',
        name: '',
        image: ''
      },
      qq: {
        id: '',
        name: '',
        image: ''
      },
      migu: {
        id: '',
        name: '',
        image: ''
      }
    } as Record<MusicType, UserInfo>,
    remoteClients: [] as RemoteClient[]
  }),
  actions: {
    setMaximized(maximized: boolean) {
      this.maximized = maximized;
    },
    async setCloseType(closeType: CloseType) {
      this.pageValue.closeType = closeType;
      this.saveSetting();
    },
    async setCloseTypeNoRemind(noRemind: boolean) {
      this.pageValue.closeTypeNoRemind = noRemind;
      this.saveSetting();
    },
    async maximize(maximized: boolean) {
      var res = await musicOperate('/maximize', maximized ? '1' : '0');
      if (res.data) {
        this.maximized = Boolean(res.data.maximized);
      }
    },
    hide() {
      musicOperate('/hide');
    },
    exit() {
      musicOperate('/exit');
    },
    minimize() {
      musicOperate('/minimize');
    },
    autoAppThemeChanged(noSave?: boolean, appTheme?: AppTheme) {
      if (this.autoAppTheme) {
        darkModeMediaQuery.addEventListener('change', this.handleThemeChange);
        if (isAndroid && webView2Services.enabled) {
          this.setAppTheme(appTheme);
        } else {
          this.handleThemeChange();
        }
      } else {
        darkModeMediaQuery.removeEventListener(
          'change',
          this.handleThemeChange
        );
      }
      if (!noSave) {
        storage.setValue(StorageKey.AutoAppTheme, this.autoAppTheme);
        ElMessage(messageOption('设置已更新'));
      }
    },
    handleThemeChange() {
      this.setAppTheme({ id: darkModeMediaQuery.matches ? 'dark pure' : '' });
    },
    updateDarkMode(dark: boolean) {
      if (!this.autoAppTheme) return;
      const id = dark ? 'dark' : '';
      if (this.appTheme.id == id) return;
      this.setAppTheme({ id: id });
    },
    setAppTheme(appTheme?: AppTheme) {
      let preferredColorScheme = 0;
      const dark = appTheme?.id.includes('dark');
      if (!this.autoAppTheme || !isWindows || !webView2Services.enabled) {
        preferredColorScheme = dark ? 2 : 1;
      }
      this.appTheme.id = appTheme?.id || '';
      this.appTheme.color = appTheme?.color || '';
      this.appTheme.objectURL =
        this.appTheme.id == this.customTheme.id
          ? this.customTheme.objectURL
          : '';
      this.appTheme.image =
        this.appTheme.id == this.customTheme.id ? this.customTheme.image : '';
      document.documentElement.className = this.appTheme.id;
      storage.setValue(StorageKey.AppTheme, {
        id: this.appTheme.id,
        name: this.appTheme.name
      });
      if (themeColor) {
        themeColor.content = dark ? '#13131a' : '#f7f7f7';
        if (appTheme?.id.includes('pure')) themeColor.content = 'black';
      }
      updateTheme(preferredColorScheme);
    },
    setCustomTheme(appTheme?: AppTheme) {
      this.customTheme.id = appTheme?.id || 'custom ';
      this.customTheme.image = appTheme?.image || '';
      this.customTheme.name = '自定义';
      if (this.customTheme.objectURL) {
        URL.revokeObjectURL(this.customTheme.image);
      }
      if (this.customTheme.image) {
        var blob = dataURLtoBlob(this.customTheme.image);
        if (blob) this.customTheme.objectURL = URL.createObjectURL(blob);
      }
      storage.setValue(StorageKey.CustomTheme, this.customTheme);
    },
    setLyricOptions() {
      LyricManager.setLyricOptions({
        ...this.pageValue.lyric,
        effectColor: this.pageValue.lyric.effect
          ? this.pageValue.lyric.effectColor
          : ''
      });
      this.saveSetting();
    },
    setLyricEffectColor(effectColor: string) {
      this.pageValue.lyric.effectColor = effectColor;
      this.setLyricOptions();
    },
    setPlayQuality(value: MusicQuality, noSave?: boolean) {
      this.playQuality = value;
      api.setPlayQuality(this.playQuality);
      !noSave && storage.setValue(StorageKey.PlayQuality, this.playQuality);
      if (this.remoteMode)
        musicOperate('/quality', this.playQuality.toString());
    },
    setDownloadQuality(value: MusicQuality, noSave?: boolean) {
      this.downloadQuality = value;
      api.setDownloadQuality(this.downloadQuality);
      !noSave &&
        storage.setValue(StorageKey.DownloadQuality, this.downloadQuality);
    },
    saveLocalDirectories() {
      storage.setValue(StorageKey.LocalDirectories, this.localDirectories);
    },
    saveSetting() {
      ElMessage(messageOption('设置已更新'));
      storage.setValue(StorageKey.Setting, this.pageValue);
    },
    saveUserInfo(logout?: boolean) {
      ElMessage(messageOption(logout ? '注销成功' : '登录成功'));
      storage.setValue(StorageKey.UserInfo, this.userInfo);
    },
    async setUserInfo(type: MusicType) {
      if (!this.userInfo[type]?.cookie) return;
      const userInfo = await api.userInfo(type, this.userInfo[type].cookie!);
      if (!userInfo) return;
      this.userInfo[type].id = userInfo.id;
      this.userInfo[type].name = userInfo.name;
      this.userInfo[type].image = userInfo.image;
    },
    setFadeIn(_value?: boolean, noSave?: boolean) {
      if (typeof noSave !== 'boolean') noSave = false;
      musicOperate('/fadein', this.pageValue.fadeIn ? '1' : undefined);
      !noSave && this.saveSetting();
    },
    setFont(font: string, bold: boolean, noSave?: boolean) {
      this.pageValue.font = font || '';
      !(typeof noSave === 'boolean' && noSave) && this.saveSetting();
      let fontEle = document.getElementById('music-font-style');
      if (!this.pageValue.font) {
        fontEle && fontEle.remove();
        return;
      }
      if (!fontEle) {
        fontEle = document.createElement('style');
        fontEle.id = 'music-font-style';
        document.head.appendChild(fontEle);
      }
      let styleText = `body{font-family:"${this.pageValue.font}";font-weight: ${
        bold ? 'bold' : 'unset'
      }}`;
      fontEle.innerText = styleText;
    },
    setGpuAcceleration(_value?: boolean, noSave?: boolean) {
      musicOperate('/gpu', this.pageValue.gpuAcceleration ? undefined : '1');
      !noSave && this.saveSetting();
    },
    setStartup() {
      this.saveSetting();
    },
    setPlayAtRun() {
      this.saveSetting();
    },
    setSavePlayProgress() {
      this.saveSetting();
    },
    setOnlyAddMusicListAtDbClick() {
      this.saveSetting();
    },
    setGlobalShortcutUsed() {
      this.registerGlobalShortCutAll();
      this.saveSetting();
    },
    setSystemMediaShortcutUsed() {
      this.registerGlobalShortCutMedia();
      this.saveSetting();
    },
    getShortcutKey(
      event: ShortcutKey,
      defaultKey?: ShortcutKey
    ): ShortcutKey | null {
      if (
        (!event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !event.metaKey) ||
        controlKeys.includes(event.key.toLowerCase())
      )
        return defaultKey || null;
      return {
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        key: event.code || event.key
      };
    },
    getShortcutText(shortKeys: ShortcutKey) {
      const shortcuts = [];
      if (shortKeys.ctrlKey) shortcuts.push('Ctrl');
      if (shortKeys.shiftKey) shortcuts.push('Shift');
      if (shortKeys.altKey) shortcuts.push('Alt');
      if (shortKeys.metaKey) shortcuts.push('Win');
      let key = shortKeys.code || shortKeys.key;
      if (/^Key[A-Z]$/.test(key)) key = key.replace('Key', '');
      return shortcuts.join(' + ') + ' + ' + key.replace('Arrow', '');
    },
    registerShortCut(
      operate: ShortcutType,
      event: ShortcutKey | null,
      noSave?: boolean
    ) {
      if (!event) return;
      (event as any).preventDefault && (event as any).preventDefault();
      const shortcutKey = this.getShortcutKey(event);
      if (!shortcutKey) return;
      this.pageValue.shortcut[operate].ctrlKey = shortcutKey.ctrlKey;
      this.pageValue.shortcut[operate].shiftKey = shortcutKey.shiftKey;
      this.pageValue.shortcut[operate].altKey = shortcutKey.altKey;
      this.pageValue.shortcut[operate].metaKey = shortcutKey.metaKey;
      this.pageValue.shortcut[operate].key = shortcutKey.key;
      this.pageValue.shortcut[operate].status = '';
      this.pageValue.shortcutText[operate] = this.getShortcutText(shortcutKey);
      !noSave && this.saveSetting();
    },
    setGlobalShortCut(
      operate: ShortcutType,
      event: ShortcutKey | null,
      noSave?: boolean
    ) {
      if (!event) return;
      const shortcutKey = this.getShortcutKey(event);
      if (!shortcutKey) return;
      this.pageValue.globalShortcut[operate].ctrlKey = shortcutKey.ctrlKey;
      this.pageValue.globalShortcut[operate].shiftKey = shortcutKey.shiftKey;
      this.pageValue.globalShortcut[operate].altKey = shortcutKey.altKey;
      this.pageValue.globalShortcut[operate].metaKey = shortcutKey.metaKey;
      this.pageValue.globalShortcut[operate].key = shortcutKey.key;
      this.pageValue.globalShortcut[operate].status = '';
      this.pageValue.globalShortcutText[operate] =
        this.getShortcutText(shortcutKey);
      !noSave && this.saveSetting();
      if (this.pageValue.globalShortcutUsed) {
        this.registerGlobalShortCut([
          {
            ...this.pageValue.globalShortcut[operate],
            type: operate
          }
        ]);
      }
    },
    async registerGlobalShortCut(
      shortcutKeys: ShortcutKey[],
      cancel?: boolean
    ) {
      if (!shortcutKeys || shortcutKeys.length <= 0) return;
      const result = await musicOperate(
        '/hotkey' + (cancel ? '?cancel=true' : ''),
        JSON.stringify(shortcutKeys)
      );
      if (result && result.data) {
        Object.keys(result.data).map(operate => {
          if (this.pageValue.globalShortcut[operate as ShortcutType]) {
            this.pageValue.globalShortcut[operate as ShortcutType].status =
              result.data[operate] || '';
          }
        });
      }
    },
    registerGlobalShortCutAll() {
      this.registerGlobalShortCut(
        Object.keys(this.pageValue.globalShortcut).map((operate: any) => {
          const shortcutKey =
            this.pageValue.globalShortcut[operate as ShortcutType];
          return {
            ...shortcutKey,
            type: operate
          };
        }),
        !this.pageValue.globalShortcutUsed
      );
    },
    registerGlobalShortCutMedia() {
      this.registerGlobalShortCut(
        [
          {
            key: 'Media',
            type: 'Media'
          }
        ],
        !this.pageValue.systemMediaShortcutUsed
      );
    },
    setDisableAnimation(value: boolean, noSave?: boolean) {
      if (value != this.pageValue.disableAnimation) {
        this.pageValue.disableAnimation = value;
      }
      !(typeof noSave === 'boolean' && noSave) && this.saveSetting();
      if (this.pageValue.disableAnimation) {
      }
      let fontEle = document.getElementById('music-animation-style');
      if (!this.pageValue.disableAnimation) {
        fontEle && fontEle.remove();
        return;
      }
      if (!fontEle) {
        fontEle = document.createElement('style');
        fontEle.id = 'music-animation-style';
        document.head.appendChild(fontEle);
      }
      fontEle.innerText = `*{animation: none !important;transition: none !important}`;
    },
    async updateRemoteClients() {
      if (!this.remoteMode) return;
      clearArray(this.remoteClients);
      const data: RemoteClient[] = await musicOperate(
        '/remote/clients',
        void 0,
        void 0,
        'GET'
      );
      if (!data || !Array.isArray(data)) return;
      data.forEach(item => {
        this.remoteClients.push({
          ...item,
          origin:
            location.protocol +
            '//' +
            item.address +
            (item.port ? ':' + item.port : ''),
          local:
            item.address === location.host ||
            item.address === location.hostname ||
            httpAddress.includes(item.address)
        });
      });
    },
    async initValue(remoteMode: boolean) {
      this.remoteMode = remoteMode;
      this.setCustomTheme(await storage.getValue(StorageKey.CustomTheme));
      this.autoAppTheme = Boolean(
        await storage.getValue(StorageKey.AutoAppTheme)
      );
      if (this.autoAppTheme) {
        this.autoAppThemeChanged(
          true,
          await storage.getValue(StorageKey.AppTheme)
        );
      } else {
        this.setAppTheme(await storage.getValue(StorageKey.AppTheme));
      }
      const settingCache: any = await storage.getValue(StorageKey.Setting);
      const ignoreKeys = [
        'lyric',
        'shortcut',
        'shortcutText',
        'globalShortcut',
        'globalShortcutText'
      ];
      if (settingCache) {
        Object.keys(settingCache).map(key => {
          if (
            settingCache[key] != null &&
            !ignoreKeys.includes(key) &&
            (this.pageValue as any)[key] !== settingCache[key]
          ) {
            (this.pageValue as any)[key] = settingCache[key];
          } else if (key === 'lyric' && settingCache[key]) {
            Object.keys(settingCache[key]).map((option: string) => {
              if (settingCache[key][option] && option in this.pageValue.lyric) {
                this.pageValue.lyric[option as LyricOptionsKey] =
                  settingCache[key][option];
              }
            });
          } else if (key === 'shortcut' && settingCache[key]) {
            Object.keys(settingCache[key]).map((operate: any) => {
              if (
                settingCache[key][operate] &&
                operate in this.pageValue.shortcut
              ) {
                this.registerShortCut(
                  operate,
                  this.getShortcutKey(
                    settingCache[key][operate],
                    this.pageValue.shortcut[operate as ShortcutType]
                  ),
                  true
                );
              }
            });
          } else if (key === 'globalShortcut' && settingCache[key]) {
            Object.keys(settingCache[key]).map((operate: any) => {
              if (
                settingCache[key][operate] &&
                operate in this.pageValue.globalShortcut
              ) {
                this.setGlobalShortCut(
                  operate,
                  this.getShortcutKey(
                    settingCache[key][operate],
                    this.pageValue.globalShortcut[operate as ShortcutType]
                  ),
                  true
                );
              }
            });
          }
        });
      }
      const userInfoCache: any = await storage.getValue(StorageKey.UserInfo);
      if (userInfoCache) {
        Object.keys(userInfoCache).map(musicType => {
          const userInfo = userInfoCache[musicType as MusicType];
          if (this.userInfo[musicType as MusicType]) {
            this.userInfo[musicType as MusicType].cookie =
              userInfo?.cookie || '';
            this.setUserInfo(musicType as MusicType);
          }
        });
      }
      const localDirectories: DirectoryInfo[] = await storage.getValue(
        StorageKey.LocalDirectories
      );
      if (Array.isArray(localDirectories)) {
        this.localDirectories.splice(0, 0, ...localDirectories);
      }
      this.setFadeIn(this.pageValue.fadeIn, true);
      this.setGpuAcceleration(this.pageValue.gpuAcceleration, true);
      this.setFont(this.pageValue.font, this.pageValue.fontBold, true);
      this.setDisableAnimation(this.pageValue.disableAnimation, true);
      musicOperate('/fonts')
        .then(fonts => {
          if (Array.isArray(fonts)) {
            this.fonts = [];
            this.fonts.push(...fonts);
          }
        })
        .finally(() => {
          this.registerGlobalShortCutAll();
          this.registerGlobalShortCutMedia();
        });
      this.setPlayQuality(
        (await storage.getValue(StorageKey.PlayQuality)) || 'SQ',
        true
      );
      this.setDownloadQuality(
        (await storage.getValue(StorageKey.DownloadQuality)) || 'ZQ',
        true
      );
      LyricManager.setLyricOptions({
        ...this.pageValue.lyric,
        effectColor: this.pageValue.lyric.effect
          ? this.pageValue.lyric.effectColor
          : ''
      });
      this.updateRemoteClients();
    }
  }
});
