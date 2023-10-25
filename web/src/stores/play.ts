import { defineStore } from 'pinia';
import * as api from '../utils/api/api';
import { Music, Playlist, SortType, WindowInfo } from '../utils/type';
import { CommunicationClient, musicOperate, wsClient } from '../utils/http';
import { StorageKey, storage } from '../utils/storage';
import { getRandomInt } from '../utils/utils';

interface PlayStatus {
  currentTime: string;
  playing: boolean;
  stopped: boolean;
  totalTime: string;
  progress: number;
  volume: number;
  disableUpdateProgress?: boolean;
  volumeCache: number;
}

var checkingStatus: boolean = false;
var nextPlay: Music | null = null;

var webSocketClient: CommunicationClient | null = null;
export const usePlayStore = defineStore('play', {
  state: () => {
    return {
      music: {} as Music,
      musicList: [] as Music[],
      myLoves: [] as Music[],
      myLover: {} as any,
      myFavorites: [] as Playlist[],
      myFavorite: {} as any,
      sortType: SortType.Loop as SortType,
      musicHistory: [] as Music[],
      currentListShow: false,
      playDetailShow: false,
      playerMode: '',
      windowInfo: {} as WindowInfo,
      playStatus: {
        currentTime: '00:00',
        playing: false,
        stopped: true,
        totalTime: '',
        progress: 0,
        volume: 0,
        volumeCache: 100
      } as PlayStatus
    };
  },
  actions: {
    clearMusicList() {
      this.musicList.splice(0, this.musicList.length);
      storage.setValue(StorageKey.CurrentMusicList, this.musicList);
      Object.keys(this.music).map(k => {
        delete (this.music as any)[k];
      });
      storage.setValue(StorageKey.CurrentMusic, this.music);
      this.pause();
    },
    setCurrentMusic(music: Music) {
      if (!music || !music.id) return;
      Object.keys(music).map(k => {
        if ((this.music as any)[k] != (music as any)[k])
          (this.music as any)[k] = (music as any)[k];
      });
      this.add([music]);
    },
    setSortType(type: SortType) {
      this.sortType = type;
      storage.setValue(StorageKey.SortType, this.sortType);
    },
    nextPlay(music: Music) {
      this.add([music]);
      nextPlay = music;
    },
    addHistory(musics: Music[], remove?: boolean, noSave?: boolean) {
      if (!Array.isArray(musics)) return;
      if (musics.length == this.musicHistory.length && remove) {
        this.musicHistory.splice(0, musics.length);
      } else
        musics.map(music => {
          var index = this.musicHistory.findIndex(
            m => m.id == music.id && m.type == music.type
          );
          if (index >= 0) this.musicHistory.splice(index, 1);
          if (!remove) this.musicHistory.unshift(music);
        });
      if (!noSave)
        storage.setValue(StorageKey.CurrentMusicHistory, this.musicHistory);
    },
    async addMyLove(musics: Music[], remove?: boolean) {
      if (!Array.isArray(musics)) return;
      musics.map(music => {
        var index = this.myLoves.findIndex(
          m => m.id == music.id && m.type == music.type
        );
        if (remove) {
          if (index >= 0) this.myLoves.splice(index, 1);
        } else {
          if (index < 0) this.myLoves.push(music);
        }
      });
      Object.keys(this.myLover).map(m => {
        delete this.myLover[m];
      });
      this.myLoves.map(m => (this.myLover[m.type + m.id] = true));
      storage.setValue(StorageKey.MyLoves, this.myLoves);
    },
    async addMyFavorite(Playlists: Playlist[], remove?: boolean) {
      if (!Array.isArray(Playlists)) return;
      Playlists.map(playlist => {
        var index = this.myFavorites.findIndex(
          m => m.id == playlist.id && m.type == playlist.type
        );
        if (remove) {
          if (index >= 0) this.myFavorites.splice(index, 1);
        } else {
          if (index < 0) this.myFavorites.push(playlist);
        }
      });
      Object.keys(this.myFavorite).map(m => {
        delete this.myFavorite[m];
      });
      this.myFavorites.map(m => (this.myFavorite[m.type + m.id] = true));
      storage.setValue(StorageKey.MyFavorites, this.myFavorites);
    },
    add(musics: Music[]) {
      if (!musics) return;
      const lastLength = this.musicList.length;
      musics.map(music => {
        var index = this.musicList.findIndex(
          m => m.id == music.id && m.type == music.type
        );
        if (index < 0) this.musicList.push(music);
      });
      lastLength != this.musicList.length &&
        storage.setValue(StorageKey.CurrentMusicList, this.musicList);
      if (!this.music.id && this.musicList.length > 0) {
        this.setCurrentMusic(this.musicList[0]);
      }
    },
    async play(music?: Music, musicList?: Music[]) {
      if (!music && musicList && musicList[0]) music = musicList[0];
      if (!music && this.playStatus.stopped) music = this.music;
      if (!music) {
        checkingStatus = true;
        const res = await musicOperate('/play');
        this.setStatus(res.data);
        return;
      }
      const m = await api.musicDetail(music);
      if (!m || !m.url) {
        console.log('fail', music);
        return;
      }
      console.log('play', music);
      if (
        music.id != this.music.id &&
        this.playStatus.stopped &&
        this.playStatus.progress > 0
      ) {
        await musicOperate('/progress', '0');
      }
      this.setCurrentMusic(m);
      checkingStatus = true;
      const res = await musicOperate('/play', music.url);
      this.setStatus(res.data);
      storage.setValue(StorageKey.CurrentMusic, this.music);
      if (Array.isArray(musicList)) {
        this.musicList.splice(0, this.musicList.length);
        this.add(musicList);
      }
      this.addHistory([this.music]);
      this.setTitle();
    },
    async pause() {
      checkingStatus = true;
      var res = await musicOperate('/pause');
      this.setStatus(res.data);
    },
    setWindowInfo(data: any) {
      this.windowInfo.maximized = data.maximized;
      this.windowInfo.width = data.width;
      this.windowInfo.height = data.height;
      this.windowInfo.x = data.x;
      this.windowInfo.y = data.y;
    },
    async window() {
      var res = await musicOperate('/window');
      res.data && this.setWindowInfo(res.data);
    },
    async maximize(maximized: boolean) {
      var res = await musicOperate('/maximize', maximized ? '1' : '0');
      res.data && this.setWindowInfo(res.data);
    },
    async close() {
      var res = await musicOperate('/close');
      res.data && this.setWindowInfo(res.data);
    },
    async minimize() {
      var res = await musicOperate('/minimize');
      res.data && this.setWindowInfo(res.data);
    },
    async next(auto?: boolean) {
      if (typeof auto !== 'boolean') auto = false;
      if (nextPlay) {
        this.play(nextPlay);
        nextPlay = null;
        return;
      }
      var currentIndex = this.musicList.findIndex(
        m => m.id == this.music.id && m.type == this.music.type
      );
      switch (this.sortType) {
        case SortType.Loop:
          currentIndex++;
          break;
        case SortType.Order:
          if (auto && currentIndex == this.musicList.length - 1) return;
          currentIndex++;
          break;
        case SortType.Random:
          currentIndex = getRandomInt(0, this.musicList.length);
          break;
      }
      if (currentIndex < 0 || currentIndex >= this.musicList.length)
        currentIndex = 0;
      if (this.musicList[currentIndex]) {
        this.setCurrentMusic(this.musicList[currentIndex]);
      }
      this.play(this.music);
    },
    async last() {
      nextPlay = null;
      this.musicHistory.splice(this.musicHistory.length - 1, 1);
      const musicH = this.musicHistory.splice(
        this.musicHistory.length - 1,
        1
      )[0];
      var ok = false;
      if (musicH) {
        const music = this.musicList.find(
          m => m.id == musicH.id && m.type == musicH.type
        );
        if (music) {
          this.setCurrentMusic(music);
          ok = true;
        }
      }
      if (!ok) {
        let currentIndex = this.musicList.findIndex(
          m => m.id == this.music.id && m.type == this.music.type
        );
        if (currentIndex == 0) currentIndex = this.musicList.length - 1;
        else if (--currentIndex < 0) currentIndex = 0;
        this.setCurrentMusic(this.musicList[currentIndex]);
      }
      this.play(this.music);
    },
    async changeProgress(value: number) {
      checkingStatus = true;
      this.playStatus.disableUpdateProgress = false;
      var res = await musicOperate('/progress', value.toString());
      this.setStatus(res.data);
    },
    async changeVolume(value: number) {
      if (value == null || !(value >= 0)) return;
      checkingStatus = true;
      var res = await musicOperate('/volume', value.toString());
      this.setStatus(res.data);
      storage.setValue(StorageKey.Volume, this.playStatus.volume);
    },
    async mute() {
      if (this.playStatus.volume === 0) {
        await this.changeVolume(this.playStatus.volumeCache || 100);
      } else {
        this.playStatus.volumeCache = this.playStatus.volume || 100;
        storage.setValue(StorageKey.VolumeCache, this.playStatus.volumeCache);
        await this.changeVolume(0);
      }
      storage.setValue(StorageKey.Volume, this.playStatus.volume);
    },
    async setStatus(data: PlayStatus) {
      try {
        checkingStatus = false;
        if (!data) return;
        if (this.playStatus.playing != data.playing) {
          this.playStatus.playing = data.playing;
        }
        if (this.playStatus.stopped != data.stopped) {
          this.playStatus.stopped = data.stopped;
        }
        if (this.playStatus.currentTime != data.currentTime) {
          this.playStatus.currentTime = data.currentTime || '00:00';
        }
        if (data.totalTime && this.playStatus.totalTime != data.totalTime) {
          this.playStatus.totalTime = data.totalTime;
        }
        if (this.playStatus.volume != data.volume) {
          this.playStatus.volume = data.volume;
          storage.setValue(StorageKey.Volume, data.volume);
          if (this.playStatus.volumeCache != data.volume && data.volume > 0) {
            this.playStatus.volumeCache = data.volume;
            storage.setValue(StorageKey.VolumeCache, data.volume);
          }
        }
        if (
          !this.playStatus.disableUpdateProgress &&
          this.playStatus.progress != data.progress
        ) {
          this.playStatus.progress = data.progress || 0;
        }
      } catch {}
    },
    wsMessage(result: any) {
      if (!result) return;
      try {
        switch (result.type) {
          case 'status':
            if (!checkingStatus) {
              if (this.playStatus.playing && result.data.stopped) {
                this.next(true);
              } else {
                this.setStatus(result.data);
              }
            }
            break;
          case 'window':
            result.data && this.setWindowInfo(result.data);
            break;
          case 'maximized':
            if (typeof result.data == 'boolean') {
              this.windowInfo.maximized = result.data;
            }
            break;
          case 'play':
            this.play();
            break;
          case 'pause':
            this.pause();
            break;
          case 'next':
            this.next();
            break;
          case 'last':
            this.last();
            break;
        }
      } catch {}
    },
    wsClose() {
      setTimeout(() => {
        webSocketClient = wsClient(this.wsMessage, this.wsClose);
      }, 1000);
    },
    sendWsStatus() {
      if (checkingStatus) return;
      webSocketClient &&
        webSocketClient.readyState == WebSocket.OPEN &&
        webSocketClient.send('/status\n');
    },
    setTitle() {
      if (this.music && this.music.name) {
        musicOperate(
          '/title',
          `${this.music.name}${(this.music.singer && ' - ') || ''}${
            this.music.singer || ''
          }`
        );
      } else {
        musicOperate('/title', `音乐和`);
      }
    },
    async startCheck() {
      if (webSocketClient) return;
      await this.initValue();
      webSocketClient = wsClient(this.wsMessage, this.wsClose);
      setInterval(this.sendWsStatus, 500);
      this.setTitle();
      this.window();
    },
    changePlayerMode(mode: string) {
      this.playerMode = mode;
      storage.setValue(StorageKey.PlayerMode, mode);
    },
    async initValue() {
      this.setCurrentMusic(await storage.getValue(StorageKey.CurrentMusic));
      this.addMyLove(await storage.getValue(StorageKey.MyLoves));
      this.addMyFavorite(await storage.getValue(StorageKey.MyFavorites));
      this.addHistory(
        await storage.getValue(StorageKey.CurrentMusicHistory),
        false,
        true
      );
      this.sortType = await storage.getValue(StorageKey.SortType);
      this.playerMode = await storage.getValue(StorageKey.PlayerMode);
      this.playStatus.volumeCache = await storage.getValue(
        StorageKey.VolumeCache
      );
      this.changeVolume(await storage.getValue(StorageKey.Volume));
      // music: (storage.getValue(StorageKey.CurrentMusic) || {}) as Music,
      // musicList: (storage.getValue(StorageKey.CurrentMusicList) ||
      //   []) as Music[],
      // sortType: (storage.getValue(StorageKey.SortType) ||
      //   SortType.Loop) as SortType,
    }
  }
});
