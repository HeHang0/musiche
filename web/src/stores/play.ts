import { defineStore } from 'pinia';
import * as api from '../utils/api/api';
import { Music, MusicType, Playlist, SortType } from '../utils/type';
import { musicOperate } from '../utils/http';
import { StorageKey, storage } from '../utils/storage';
import { generateGuid, getRandomInt } from '../utils/utils';
import { useTitle } from '@vueuse/core';

const title = useTitle();

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

export const usePlayStore = defineStore('play', {
  state: () => {
    return {
      music: {} as Music,
      musicList: [] as Music[],
      myLoves: [] as Music[],
      myLover: {} as any,
      myFavorites: [] as Playlist[],
      myFavorite: {} as any,
      myPlaylists: [] as Playlist[],
      myPlaylistsPreMusics: undefined as Music[] | undefined,
      sortType: SortType.Loop as SortType,
      musicHistory: [] as Music[],
      currentListShow: false,
      currentMusicType: MusicType.CloudMusic as MusicType,
      currentMusicTypeShow: true,
      playDetailShow: false,
      selectPlaylistShow: false,
      playerMode: '',
      playStatus: {
        currentTime: '00:00',
        playing: false,
        stopped: true,
        totalTime: '',
        progress: 0,
        volume: 0,
        volumeCache: 100
      } as PlayStatus,
      currentListPopover: {
        show: false,
        timer: null as any
      },
      checkingStatus: false,
      nextPlay: null as Music | null,
      preparePlay: false
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
      if (!type) return;
      this.sortType = type;
      musicOperate('/loop', this.sortType.toString());
      storage.setValue(StorageKey.SortType, this.sortType);
    },
    setNextPlay(music: Music) {
      this.add([music]);
      this.showCurrentListPopover();
      this.nextPlay = music;
      if (!this.playStatus.playing) {
        this.next();
      }
    },
    addHistory(musics: Music[], remove?: boolean, init?: boolean) {
      if (!Array.isArray(musics)) return;
      if (musics.length == this.musicHistory.length && remove) {
        this.musicHistory.splice(0, musics.length);
      } else
        musics.map(music => {
          var index = this.musicHistory.findIndex(
            m => m.id == music.id && m.type == music.type
          );
          if (index >= 0) this.musicHistory.splice(index, 1);
          if (!remove) {
            if (init) this.musicHistory.push({ ...music });
            else this.musicHistory.unshift({ ...music });
          }
        });
      if (!init)
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
    async addMyFavorite(playlists: Playlist[], remove?: boolean) {
      if (!Array.isArray(playlists)) return;
      playlists.map(playlist => {
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
    showCurrentListPopover() {
      clearTimeout(this.currentListPopover.timer);
      this.currentListPopover.show = true;
      this.currentListPopover.timer = setTimeout(() => {
        this.currentListPopover.show = false;
      }, 3000);
    },
    beforeAddMyPlaylistsMusic(musics: Music[]) {
      this.myPlaylistsPreMusics = musics;
      this.selectPlaylistShow = true;
    },
    addMyPlaylistsMusic(
      playlistId: string,
      musics?: Music[],
      remove?: boolean
    ) {
      if (!musics || !Array.isArray(musics) || !playlistId) return;
      const playlist = this.myPlaylists.find(
        m => m.id == playlistId && m.type == MusicType.Local
      );
      if (!playlist) return;
      if (!playlist.musicList) playlist.musicList = [];
      musics.map(music => {
        var index = playlist.musicList?.findIndex(
          m => m.id == music.id && m.type == music.type
        );
        if (index == null) index = -1;
        if (remove) {
          if (index >= 0) playlist.musicList?.splice(index, 1);
        } else {
          if (index < 0) playlist.musicList?.push(music);
        }
      });
      storage.setValue(StorageKey.MyPlaylists, this.myPlaylists);
      if (this.selectPlaylistShow) this.selectPlaylistShow = false;
    },
    createMyPlaylists(name: string) {
      this.myPlaylists.unshift({
        id: generateGuid(),
        name: name,
        image: '',
        type: MusicType.Local,
        musicList: []
      });
      storage.setValue(StorageKey.MyPlaylists, this.myPlaylists);
    },
    addMyPlaylists(playlists: Playlist[], remove?: boolean) {
      if (!Array.isArray(playlists)) return;
      playlists.map(playlist => {
        var index = this.myPlaylists.findIndex(
          m => m.id == playlist.id && m.type == playlist.type
        );
        if (remove) {
          if (index >= 0) this.myPlaylists.splice(index, 1);
        } else {
          if (index < 0) this.myPlaylists.push(playlist);
        }
      });
      storage.setValue(StorageKey.MyPlaylists, this.myPlaylists);
    },
    add(musics: Music[], noSet?: boolean) {
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
      if (!noSet && !this.music.id && this.musicList.length > 0) {
        this.setCurrentMusic(this.musicList[0]);
      }
    },
    async play(music?: Music, musicList?: Music[]) {
      if (this.preparePlay) {
        return;
      }
      this.preparePlay = true;
      if (!music && musicList && musicList[0]) music = musicList[0];
      if (!music && this.playStatus.stopped) music = this.music;
      console.log('play', music, musicList);
      if (
        !music ||
        (!this.playStatus.stopped &&
          music.id == this.music.id &&
          music.type == this.music.type)
      ) {
        this.checkingStatus = true;
        const res = await musicOperate('/play');
        this.setStatus(res.data);
        this.preparePlay = false;
        return;
      }
      if (Array.isArray(musicList)) {
        this.musicList.splice(0, this.musicList.length);
        this.add(musicList);
      }
      const m = await api.musicDetail(music);
      if (!m || !m.url) {
        console.log('fail', music);
        if (this.playStatus.playing) {
          this.add([this.music]);
          return;
        }
        const musicIndex = this.musicList.findIndex(
          n => music && music.id == n.id && music.type == n.type
        );
        musicIndex >= 0 && this.musicList.splice(0, 1);
        this.preparePlay = false;
        this.musicList.length > 0 && this.next(true);
        return;
      }
      if (
        music.id != this.music.id &&
        this.playStatus.stopped &&
        this.playStatus.progress > 0
      ) {
        await musicOperate('/progress', '0');
      }
      this.setCurrentMusic(m);
      this.checkingStatus = true;
      const res = await musicOperate('/play', music.url);
      this.setStatus(res.data);
      storage.setValue(StorageKey.CurrentMusic, this.music);
      this.addHistory([this.music]);
      this.setTitle();
      this.preparePlay = false;
    },
    async pause() {
      this.checkingStatus = true;
      var res = await musicOperate('/pause');
      this.setStatus(res.data);
    },
    async next(auto?: boolean) {
      if (typeof auto !== 'boolean') auto = false;
      if (this.nextPlay) {
        this.play(this.nextPlay);
        this.nextPlay = null;
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
      this.play(this.musicList[currentIndex]);
    },
    async last() {
      this.nextPlay = null;
      const musicH = this.musicHistory[this.musicHistory.length - 2];
      this.addHistory(
        this.musicHistory.slice(this.musicHistory.length - 2),
        true
      );
      // this.musicHistory.splice(this.musicHistory.length - 1, 1);
      // const musicH = this.musicHistory.splice(
      //   this.musicHistory.length - 1,
      //   1
      // )[0];
      var ok = false;
      if (musicH) {
        const music = this.musicList.find(
          m => m.id == musicH.id && m.type == musicH.type
        );
        if (music) {
          this.play(music);
          ok = true;
        }
      }
      if (!ok) {
        let currentIndex = this.musicList.findIndex(
          m => m.id == this.music.id && m.type == this.music.type
        );
        if (currentIndex == 0) currentIndex = this.musicList.length - 1;
        else if (--currentIndex < 0) currentIndex = 0;
        this.play(this.musicList[currentIndex]);
      }
    },
    async changeProgress(value: number) {
      this.checkingStatus = true;
      this.playStatus.disableUpdateProgress = false;
      var res = await musicOperate('/progress', value.toString());
      this.setStatus(res.data);
    },
    async changeVolume(value: number) {
      if (value == null || isNaN(value) || value < 0 || value > 100) return;
      this.checkingStatus = true;
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
        this.checkingStatus = false;
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
    setTitle() {
      if (this.music && this.music.name) {
        title.value = `${this.music.name}${(this.music.singer && ' - ') || ''}${
          this.music.singer || ''
        }`;
      } else {
        title.value = '音乐和';
      }
      musicOperate('/title', title.value);
    },
    changePlayerMode(mode: string) {
      this.playerMode = mode;
      storage.setValue(StorageKey.PlayerMode, mode);
    },
    async initValue() {
      this.add(await storage.getValue(StorageKey.CurrentMusicList), true);
      this.setCurrentMusic(await storage.getValue(StorageKey.CurrentMusic));
      this.addMyLove(await storage.getValue(StorageKey.MyLoves));
      this.addMyFavorite(await storage.getValue(StorageKey.MyFavorites));
      this.addMyPlaylists(await storage.getValue(StorageKey.MyPlaylists));
      this.addHistory(
        await storage.getValue(StorageKey.CurrentMusicHistory),
        false,
        true
      );
      this.sortType =
        (await storage.getValue(StorageKey.SortType)) || SortType.Loop;
      this.playerMode = (await storage.getValue(StorageKey.PlayerMode)) || '';
      this.playStatus.volumeCache = await storage.getValue(
        StorageKey.VolumeCache
      );
      this.changeVolume(await storage.getValue(StorageKey.Volume));
      musicOperate('/loop', this.sortType.toString());
      this.setTitle();
    }
  }
});
