import { media } from '@kit.MediaKit';
import { formatDuration, formatTime, getRandomInt } from '../utils/utils';
import { LoopType } from './LoopType';
import { MusicItem } from './MusicItem';
import { MusicPlayRequest } from './MusicPlayRequest';
import { Quality } from './Quality';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { Context, wantAgent } from '@kit.AbilityKit';
import { avSession } from '@kit.AVSessionKit';
import { Callback } from '@ohos.base';
import { KeyEvent } from '@kit.InputKit';

export class AudioPlayer {
  private context: Context
  private session?: avSession.AVSession
  private audioPlayer?: media.AVPlayer
  private loopType: LoopType = LoopType.Loop
  private quality: Quality = Quality.PQ
  private lastIndex = 0;
  private wantAgentInfo: wantAgent.WantAgentInfo;
  private onStatusChangeSet: Set<Callback<Record<string, any>>> = new Set()
  public musicPlayRequest: MusicPlayRequest = new MusicPlayRequest();

  constructor(context: Context, wantAgentInfo: wantAgent.WantAgentInfo) {
    this.context = context
    this.wantAgentInfo = wantAgentInfo
    media.createAVPlayer().then(this.initPlayer)
  }

  public show(){
    this.sendStatusChange({'type': 'show'})
  }

  private isInitSession = false
  private initSession = async () => {
    if (this.session || this.isInitSession) {
      return
    }
    this.isInitSession = true
    try {
      this.session = await avSession.createAVSession(this.context, 'Musiche', 'audio')
      await this.session.activate()
      this.session.on('play', this.playCurrent)
      this.session.on('pause', this.pause)
      this.session.on('stop', this.stop)
      this.session.on('playPrevious', this.skipToPrevious)
      this.session.on('playNext', this.skipToNext)
      this.session.on('seek', this.seek)
      this.session.on('setLoopMode', this.setLoopMode)
      this.session.on('toggleFavorite', this.setLover)
      this.session.on('handleKeyEvent', this.handleKeyEvent)
      this.session.on('outputDeviceChange', this.outputDeviceChanged)
      const agent = await wantAgent.getWantAgent(this.wantAgentInfo)
      this.session?.setLaunchAbility(agent);
    } finally {
      this.isInitSession = false
    }
  }

  public async destroy() {
    if (!this.session) {
      return
    }
    this.session.off('play', this.playCurrent)
    this.session.off('pause', this.pause)
    this.session.off('stop', this.stop)
    this.session.off('playPrevious', this.skipToPrevious)
    this.session.off('playNext', this.skipToNext)
    this.session.off('seek', this.seek)
    this.session.off('setLoopMode', this.setLoopMode)
    this.session.off('toggleFavorite', this.setLover)
    this.session.off('handleKeyEvent', this.handleKeyEvent)
    this.session.off('outputDeviceChange', this.outputDeviceChanged)
    await this.session.deactivate()
    await this.session.destroy()
  }

  private sendStatusChange(data: object){
    this.onStatusChangeSet.forEach(m => m(data))
  }

  private setLover = async () => {
    const data = {
      type: 'lover',
      data: {
        type: this.musicPlayRequest.music?.type,
        id: this.musicPlayRequest.music?.id
      }
    }
    if (this.musicPlayRequest.music) {
      this.musicPlayRequest.music.lover = !this.musicPlayRequest.music.lover
      await this.updateMediaState()
    }
    this.sendStatusChange(data)
  }

  private outputDeviceChanged = (state: avSession.ConnectionState, device: avSession.OutputDeviceInfo) => {

  }

  private handleKeyEvent = (event: KeyEvent) => {

  }

  public onStatusChange(callback: Callback<Record<string, any>>) {
    this.onStatusChangeSet.add(callback)
  }

  public offStatusChange(callback: Callback<Record<string, any>>) {
    this.onStatusChangeSet.delete(callback)
  }

  private initPlayer = (player: media.AVPlayer) => {
    this.audioPlayer = player
    player.on('seekDone', this.onSeekDone)
    player.on('error', this.onError)
    player.on('stateChange', this.onStateChange)
    player.on('durationUpdate', this.onDurationUpdate)
    player.on('timeUpdate', this.onTimeUpdate)
  }
  onSeekDone = (data: number) => {

  }
  onError = (err) => {
    hilog.error(0x0000, AudioPlayer.name, 'audio player err: ' + JSON.stringify(err));
    this.audioPlayer?.reset()
  }
  onStateChange = async (state: media.AVPlayerState, reason: media.StateChangeReason) => {
    hilog.info(0x0000, AudioPlayer.name, 'audio player state: ' + state);
    if (state === 'initialized') {
      await this.audioPlayer.prepare();
    } else if (state === 'prepared') {
      await this.audioPlayer.play();
    } else if (this.audioPlayer!.state === 'completed') {
      this.skipToNext();
    }
    await this.setMediaMeta()
    await this.updateMediaState();
  }
  onDurationUpdate = (duration: number) => {
    this.updateMediaState()
  }
  private lastMillSecond = 0
  onTimeUpdate = (position: number) => {
    const millSecond = new Date().valueOf()
    if (millSecond - this.lastMillSecond < 500) {
      return
    }
    this.lastMillSecond = millSecond
    this.updateMediaState()
  }

  public setLoopType(loopType: LoopType) {
    this.loopType = loopType;
  }

  public setQuality(quality: Quality) {
    this.quality = quality;
  }

  public getLoopType() {
    return this.loopType;
  }

  public getCurrentMusic() {
    return this.musicPlayRequest.music;
  }

  public setMusicPlayRequest = (data: object) => {
    this.musicPlayRequest.setData(data)
  }

  public playIndex = (index: number) => {
    const music = this.musicPlayRequest?.playlist[index];
    this.playMusic(music);
  }

  public async playMusic(music?: MusicItem) {
    if (music == null) {
      return;
    }
    this.lastIndex = this.musicPlayRequest.index
    this.musicPlayRequest.music = music
    let index = this.musicPlayRequest.playlist.indexOf(music);
    if (index >= 0) {
      this.musicPlayRequest.index = index;
    } else {
      this.musicPlayRequest.playlist.push(music);
      this.musicPlayRequest.index = this.musicPlayRequest.playlist.length - 1;
      index = this.musicPlayRequest.index
    }
    const url = await music.getMusicUrl(this.quality);
    if (url) {
      this.playUrl(url)
    } else {
      this.musicPlayRequest.playlist.splice(index, 1)
      this.sendStatusChange({
        type: 'remove',
        data: {
          type: this.musicPlayRequest.music?.type,
          id: this.musicPlayRequest.music?.id
        }
      })
      this.skipToNext()
    }
  }

  public async playUrl(url: string) {
    if (!url) {
      this.playCurrent()
      return
    }
    if (!this.audioPlayer) {
      return
    }
    await this.audioPlayer.reset()
    if (url.startsWith("http")) {
      hilog.info(0x0000, AudioPlayer.name, 'audio player url: ' + url);
      this.audioPlayer.url = url
    } else {
      //TODO playFile
    }
    this.setMediaMeta()
  }

  public playCurrent = async () => {
    if (!this.audioPlayer) {
      return
    }
    if ((this.audioPlayer.state === 'completed' ||
      this.audioPlayer.state === 'idle') &&
      this.musicPlayRequest.music != null) {
      await this.playMusic(this.musicPlayRequest.music);
    } else {
      await this.audioPlayer.play();
      this.setMediaMeta()
    }
  }

  public setPosition = (milliseconds: number) => {
    this.audioPlayer?.seek(milliseconds);
  }

  public seek = (milliseconds: number) => {
    this.audioPlayer?.seek(milliseconds);
  }

  public stop = () => {
    this.audioPlayer?.stop()
  }

  public setProgress(progress: number) {
    if (!this.audioPlayer) {
      return
    }
    const duration = this.audioPlayer.duration
    if (progress < 0 || !(duration > 0)) {
      return;
    }
    const position = Math.floor(progress * duration / 1000)
    this.setPosition(position)
  }

  public getProgress(position?: number, duration?: number) {
    if (!this.audioPlayer) {
      return 0
    }
    if (isNaN(position)) {
      position = this.audioPlayer.currentTime
    }
    if (isNaN(duration)) {
      duration = this.audioPlayer.duration
    }
    return Math.ceil(position! * 1000 / duration!)
  }

  public pause = () => {
    this.audioPlayer?.pause()
  }

  private autoPlayDelay: number | null = null

  public skipToNext = () => {
    clearTimeout(this.autoPlayDelay)
    this.autoPlayDelay = setTimeout(this.next, 50)
  }

  private next = () => {
    if ((this.musicPlayRequest.playlist.length ?? 0) == 0 || this.loopType == LoopType.Single) {
      this.playCurrent();
      return;
    }
    let index = this.musicPlayRequest.index + 1;
    switch (this.loopType) {
      case LoopType.Loop:
        if (index >= this.musicPlayRequest.playlist.length) {
          index = 0;
        }
        break;
      case LoopType.Order:
        if (index >= this.musicPlayRequest.playlist.length) {
          this.pause();
        }
        break;
      case LoopType.Random:
        index = getRandomInt(this.musicPlayRequest.playlist.length);
        break;
      default:
        break;
    }
    this.playIndex(index);
  }

  public skipToPrevious = () => {
    this.playIndex(this.lastIndex);
  }

  private mediaStateSetting = false
  public updateMediaState = async () => {
    if(this.mediaStateSetting) {
      return
    }
    const status = this.getStatus()
    this.sendStatusChange(status)
    this.initSession()
    if (!this.musicPlayRequest.music || !this.session || !this.audioPlayer) {
      return
    }
    this.mediaStateSetting = true
    try {
      await this.session.setAVPlaybackState({
        state: AudioPlayer.sessionState[this.audioPlayer.state],
        position: { elapsedTime: status.data.position, updateTime: (new Date()).getTime() },
        loopMode: AudioPlayer.sessionLoopMode[this.loopType],
        isFavorite: this.musicPlayRequest.music.lover,
        duration: status.data.duration,
        // speed: 1,
        // bufferedTime: number,
        // activeItemId: number,
        // volume: number,
        // maxVolume: number,
        // muted: boolean,
      })
    } catch (e) {
      hilog.info(0x0000, AudioPlayer.name, 'audio player updateMediaState err: ' + JSON.stringify(e));
    }
    this.mediaStateSetting = false
  }

  private setLoopMode = (loopMode: avSession.LoopMode) => {
    this.loopType = AudioPlayer.audioLoopType[loopMode]
  }

  private static readonly sessionLoopMode: Record<LoopType, avSession.LoopMode> = {
    [LoopType.Loop]: avSession.LoopMode.LOOP_MODE_LIST,
    [LoopType.Single]: avSession.LoopMode.LOOP_MODE_SINGLE,
    [LoopType.Random]: avSession.LoopMode.LOOP_MODE_SHUFFLE,
    [LoopType.Order]: avSession.LoopMode.LOOP_MODE_SEQUENCE,
  }
  private static readonly audioLoopType: Record<avSession.LoopMode, LoopType> = {
    [avSession.LoopMode.LOOP_MODE_LIST]: LoopType.Loop,
    [avSession.LoopMode.LOOP_MODE_SINGLE]: LoopType.Single,
    [avSession.LoopMode.LOOP_MODE_SHUFFLE]: LoopType.Random,
    [avSession.LoopMode.LOOP_MODE_SEQUENCE]: LoopType.Order,
    [avSession.LoopMode.LOOP_MODE_CUSTOM]: LoopType.Loop
  }

  private static readonly sessionState: Record<media.AVPlayerState, avSession.PlaybackState> = {
    completed: avSession.PlaybackState.PLAYBACK_STATE_COMPLETED,
    error: avSession.PlaybackState.PLAYBACK_STATE_ERROR,
    idle: avSession.PlaybackState.PLAYBACK_STATE_IDLE,
    initialized: avSession.PlaybackState.PLAYBACK_STATE_INITIAL,
    paused: avSession.PlaybackState.PLAYBACK_STATE_PAUSE,
    playing: avSession.PlaybackState.PLAYBACK_STATE_PLAY,
    prepared: avSession.PlaybackState.PLAYBACK_STATE_PREPARE,
    released: avSession.PlaybackState.PLAYBACK_STATE_RELEASED,
    stopped: avSession.PlaybackState.PLAYBACK_STATE_STOP
  }

  private mediaMetaSetting = false
  public setMediaMeta = async (data?: Record<string, any>) => {
    if(this.mediaMetaSetting) {
      return
    }
    this.initSession()
    if ((!this.musicPlayRequest.music && !data) || !this.session || !this.audioPlayer) {
      return
    }
    this.mediaMetaSetting = true
    try {
      await this.session.setAVMetadata({
        assetId: data?.id || '0',
        title: data?.title || this.musicPlayRequest.music.name,
        artist: data?.artist || this.musicPlayRequest.music.singer,
        author: data?.artist || this.musicPlayRequest.music.singer,
        album: data?.album || this.musicPlayRequest.music.album,
        writer: data?.artist || this.musicPlayRequest.music.singer,
        composer: data?.artist || this.musicPlayRequest.music.singer,
        duration: data?.duration || this.audioPlayer.duration,
        mediaImage: Array.isArray(data?.artwork && data?.artwork.length > 0) ? data?.artwork[0].src : (data ? '' :
          (this.musicPlayRequest.music.largeImage || this.musicPlayRequest.music.mediumImage ||
          this.musicPlayRequest.music.image)),
        // subtitle: '',
        // description: '',
        // lyric: '',
        // previousAssetId: '',
        // nextAssetId: '',
        // drmSchemes: [];
        skipIntervals: avSession.SkipIntervals.SECONDS_10
      })
    } catch (e) {
      hilog.info(0x0000, AudioPlayer.name, 'audio player updateMediaState err: ' + JSON.stringify(e));
    }
    this.mediaMetaSetting = false
  }

  public getStatus = (position?: number, duration?: number): { data: Record<string, any>, type: string } => {
    if (!this.audioPlayer) {
      return { data: {}, type: '' }
    }
    if (isNaN(position)) {
      position = this.audioPlayer.currentTime
    }
    if (isNaN(duration)) {
      duration = this.audioPlayer.duration
    }
    if(!duration && this.musicPlayRequest.music && this.musicPlayRequest.music.duration) {
      if(typeof this.musicPlayRequest.music.duration === 'number') {
        duration = this.musicPlayRequest.music.duration
      }else {
        duration = formatTime(this.musicPlayRequest.music.duration)
      }
    }
    const progress = this.getProgress(position, duration);
    const data: Record<string, any> = {
      "volume": 100,
      "position": position,
      "duration": duration,
      "currentTime": formatDuration(position),
      "totalTime": formatDuration(duration),
      "playing": this.audioPlayer.state === 'playing',
      "stopped": false, //this.audioPlayer.state === 'completed' | 'idle' | 'released' | 'error'
      "progress": progress
    }
    if (this.musicPlayRequest.music) {
      data["id"] = this.musicPlayRequest.music.id
      data["type"] = this.musicPlayRequest.music.type
    }
    return { data, type: 'status' }
  }
}