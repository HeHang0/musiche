import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_volume_controller/flutter_volume_controller.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musiche/log/logger.dart';

import 'music_item.dart';
import 'music_play_request.dart';

enum LoopType {
  loop, random, order, single
}
class AudioPlay extends BaseAudioHandler {
  static const String _tag = "AudioPlay";
  late final AudioPlayer _audioPlayer;
  late final StreamController<MusicItem> _onLoverChanged;
  Stream<PlayerState> get onPlayerStateChanged => _audioPlayer.playerStateStream;
  Stream<MusicItem> get onLoverChanged => _onLoverChanged.stream;
  Stream<Duration?> get onDurationChanged => _audioPlayer.durationStream;
  Stream<Duration> get onPositionChanged => _audioPlayer.positionStream;
  bool get playing => _audioPlayer.playing;
  bool get stopped => false;//_audioPlayer.playerState.processingState == ProcessingState.completed || _audioPlayer.playerState.processingState == ProcessingState.idle;
  int get volume => _volume;
  Future<Duration?> Function() get currentPosition => () => Future(() => _audioPlayer.position);
  Future<Duration?> Function() get duration => () => Future(() => _audioPlayer.duration);
  int _lastIndex = 0;
  LoopType _loopType = LoopType.loop;
  Quality _quality = Quality.pq;
  MusicPlayRequest? _musicPlayRequest;
  int _volume = 100;
  AudioPlay(){
    _audioPlayer = AudioPlayer();
    _onLoverChanged = StreamController<MusicItem>();
    _initAudioService();
    onDurationChanged.listen(_onDurationChanged);
    onPositionChanged.listen(_onPositionChanged);
    onPlayerStateChanged.listen(_onPlayerStateChanged);
    FlutterVolumeController.addListener(_onVolumeChanged);
  }

  void _onVolumeChanged(double volume){
    _volume = (100 * volume).toInt();
  }

  Future<void> _initAudioService() async {
    double volume = await FlutterVolumeController.getVolume(stream: AudioStream.music) ?? 1;
    _volume = (100 * volume).toInt();
    await AudioService.init(
      builder: () => this,
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'com.picapico.musiche.channel.audio',
        androidNotificationChannelName: 'Musiche playback',
        androidNotificationIcon: 'drawable/logo'
      ),
    );
  }

  void setLoopType(LoopType loopType){
    _loopType = loopType;
  }
  void setQuality(Quality quality){
    _quality = quality;
  }

  LoopType getLoopType(){
    return _loopType;
  }

  MusicItem? getCurrentMusic(){
    return _musicPlayRequest?.music;
  }

  void setMusicPlayRequest(MusicPlayRequest request){
    _musicPlayRequest = request;
  }

  void playIndex(int index){
    MusicItem? music = _musicPlayRequest?.playlist.elementAt(index);
    playMusic(music);
  }

  void playMusic(MusicItem? music) async {
    if(music == null) return;
    if(_musicPlayRequest != null) {
      _lastIndex = _musicPlayRequest!.index;
      _musicPlayRequest!.music = music;
      int index = _musicPlayRequest!.playlist.indexOf(music);
      if(index >= 0) {
        _musicPlayRequest!.index = index;
      }else {
        _musicPlayRequest!.playlist.add(music);
        _musicPlayRequest!.index = _musicPlayRequest!.playlist.length - 1;
      }
    }
    String url = await music.getMusicUrl(_quality);
    if(url.isNotEmpty) {
      playUrl(url);
    } else {
      _musicPlayRequest?.playlist.remove(music);
      Logger.i(_tag, "music cannot get url");
      skipToNext();
    }
  }

  @override
  Future<void> play() async {
    playCurrent();
  }
  @override
  Future<void> stop() async {
    if(_musicPlayRequest?.music == null) return;
    _musicPlayRequest!.music!.lover = !_musicPlayRequest!.music!.lover;
    _setMediaControls();
    _onLoverChanged.sink.add(_musicPlayRequest!.music!);
  }
  @override
  Future<void> seek(Duration position) async {
    _audioPlayer.seek(position);
  }
  Timer? _autoPlayDelay;
  @override
  Future<void> skipToNext() async {
    _autoPlayDelay?.cancel();
    _autoPlayDelay = Timer(const Duration(milliseconds: 50), _next);
  }
  void _next(){
    if((_musicPlayRequest?.playlist.length ?? 0) == 0 || _loopType == LoopType.single){
      playCurrent();
      return;
    }
    int index = _musicPlayRequest!.index + 1;
    switch(_loopType){
      case LoopType.loop:
        if(index >= _musicPlayRequest!.playlist.length){
          index = 0;
        }
        break;
      case LoopType.order:
        if(index >= _musicPlayRequest!.playlist.length){
          pause();
        }
        break;
      case LoopType.random:
        index = Random().nextInt(_musicPlayRequest!.playlist.length);
        break;
      default:
        break;
    }
    playIndex(index);
  }
  @override
  Future<void> skipToPrevious() async {
    playIndex(_lastIndex);
  }
  _onPlayerStateChanged(PlayerState state) async {
    setMediaMeta();
    if(_audioPlayer.playerState.processingState == ProcessingState.completed) {
      Logger.i(_tag, "onPlayerStateChanged completed");
      skipToNext();
    }
  }

  Future<void> _onPositionChanged(Duration position) async {
    if(kIsWeb) return;
    _setMediaControls();
  }

  void _setMediaControls(){
    playbackState.add(PlaybackState(
      controls: [
        const MediaControl(
          androidIcon: 'drawable/last',
          label: 'Previous',
          action: MediaAction.skipToPrevious,
        ),
        MediaControl(
          androidIcon: playing ? 'drawable/pause' : 'drawable/play',
          label: playing ? 'Pause' : 'Play',
          action: playing ? MediaAction.pause : MediaAction.play,
        ),
        const MediaControl(
          androidIcon: 'drawable/next',
          label: 'Next',
          action: MediaAction.skipToNext,
        ),
        MediaControl(
          androidIcon: (_musicPlayRequest?.music?.lover ?? false) ? 'drawable/lover_on' : 'drawable/lover_off',
          label: 'Lover',
          action: MediaAction.stop,
        )
      ],
      systemActions: const {
        MediaAction.seek
      },
      androidCompactActionIndices: const [0, 1, 3],
      processingState:  AudioProcessingState.ready,
      playing: _audioPlayer.playing,
      updatePosition: _audioPlayer.position,
      bufferedPosition: _audioPlayer.bufferedPosition,
      speed: 1.0,
      queueIndex: 0,
    ));
  }

  Future<void> _onDurationChanged(Duration? duration) async {
    setMediaMeta();
  }

  Future<void> setMediaMeta() async {
    MusicItem? music = _musicPlayRequest?.music;
    if(music == null) return;
    Duration? duration = _audioPlayer.duration;
    if(duration == null || duration.inMilliseconds == 0){
      return;
    }
    if(kIsWeb) return;
    var item = MediaItem(
        id: music.id,
        title: music.name,
        album: music.album,
        artist: music.album,
        duration: duration,
        artUri: Uri.parse(music.image)
    );
    mediaItem.add(item);
  }

  @override
  Future<void> pause() async {
    _audioPlayer.pause();
  }

  Future<void> playUrl(String url) async {
    if(url.isEmpty) {
      playCurrent();
      return;
    }
    if (url.startsWith("http")) {
      await _audioPlayer.setUrl(url);
      _audioPlayer.play();
    }else {
      File file = File(url);
      if(await file.exists()){
        await _audioPlayer.setFilePath(file.path);
        _audioPlayer.play();
      }
    }
  }
  void playCurrent(){
    if((_audioPlayer.playerState.processingState == ProcessingState.completed ||
        _audioPlayer.playerState.processingState == ProcessingState.idle) &&
        _musicPlayRequest != null && _musicPlayRequest?.music != null){
      playMusic(_musicPlayRequest?.music);
    }else {
      _audioPlayer.play();
    }
  }

  void setPosition(int milliseconds) {
    _audioPlayer.seek(Duration(milliseconds: milliseconds));
  }

  Future<void> setVolume(int volume) async {
    _volume = volume;
    await FlutterVolumeController.setVolume(volume*1.0/100, stream: AudioStream.music);
  }

  Future<void> setProgress(int progress) async {
    Duration? duration = _audioPlayer.duration;
    if(progress < 0 || duration == null || duration.inMilliseconds <= 0) {
      return;
    }
    int positionMilliseconds = progress * duration.inMilliseconds ~/ 1000;
    await _audioPlayer.seek(Duration(milliseconds: positionMilliseconds));
  }

  Future<int> getProgress({Duration? position, Duration? duration}) async {
    position ??= _audioPlayer.position;
    duration ??= _audioPlayer.duration;
    int progress = 0;
    if(duration != null && duration.inMilliseconds > 0){
      progress = position.inMilliseconds * 1000 ~/ duration.inMilliseconds;
    }
    return progress;
  }
}