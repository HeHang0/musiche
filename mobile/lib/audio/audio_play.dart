import 'dart:async';
import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musiche/utils/android_channel.dart';

import 'media_metadata.dart';

class AudioPlay extends BaseAudioHandler {
  late final AudioPlayer _audioPlayer;
  Stream<PlayerState> get onPlayerStateChanged => _audioPlayer.playerStateStream;
  Stream<Duration?> get onDurationChanged => _audioPlayer.durationStream;
  Stream<Duration> get onPositionChanged => _audioPlayer.positionStream;
  bool get playing => _audioPlayer.playing;
  bool get stopped => _audioPlayer.playerState.processingState == ProcessingState.completed || _audioPlayer.playerState.processingState == ProcessingState.idle;
  int get volume => (_audioPlayer.volume*100).toInt();
  Future<Duration?> Function() get currentPosition => () => Future(() => _audioPlayer.position);
  Future<Duration?> Function() get duration => () => Future(() => _audioPlayer.duration);
  MediaMetadata? metadata;
  AudioPlay(){
    _audioPlayer = AudioPlayer();
    _initAudioService();
    onDurationChanged.listen(_onDurationChanged);
    onPositionChanged.listen(_onPositionChanged);
    onPlayerStateChanged.listen(_onPlayerStateChanged);
  }
  Future<void> _initAudioService() async {
    await AudioService.init(
      builder: () => this,
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'com.picapico.musiche.channel.audio',
        androidNotificationChannelName: 'Musiche playback',
      ),
    );
  }

  @override
  Future<void> play() async {
    playCurrent();
  }
  // @override
  // Future<void> pause() async {}
  @override
  Future<void> stop() async {
    pause();
  }
  @override
  Future<void> seek(Duration position) async {
    _audioPlayer.seek(position);
  }
  @override
  Future<void> skipToNext() async {}
  @override
  Future<void> skipToPrevious() async {}
  // @override
  // Future<void> skipToQueueItem(int i) async {}

  _onPlayerStateChanged(PlayerState state) async {
    setMediaMeta(metadata);
  }

  Future<void> _onPositionChanged(Duration position) async {
    if(kIsWeb) return;
    if(Platform.isAndroid) {
      AndroidChannel.setMediaPosition(playing, position.inMilliseconds);
    } else{
      playbackState?.add(PlaybackState(
        controls: [
          MediaControl.skipToPrevious,
          playing ? MediaControl.pause : MediaControl.play,
          MediaControl.skipToNext,
        ],
        systemActions: const {
          MediaAction.seek
        },
        androidCompactActionIndices: const [0, 1, 2],
        processingState:  AudioProcessingState.ready,
        playing: _audioPlayer.playing,
        updatePosition: _audioPlayer.position,
        bufferedPosition: _audioPlayer.bufferedPosition,
        speed: 1.0,
        queueIndex: 0,
      ));
    }
  }

  Future<void> _onDurationChanged(Duration? duration) async {
    setMediaMeta(metadata);
  }

  Future<void> setMediaMeta(MediaMetadata? metadata) async {
    if(metadata == null) return;
    this.metadata = metadata;
    Duration? duration = _audioPlayer.duration;
    if(duration == null || duration.inMilliseconds == 0){
      return;
    }
    if(kIsWeb) return;
    if(Platform.isAndroid) {
      AndroidChannel.setMediaMetadata(metadata, playing, _audioPlayer.position.inMilliseconds, duration.inMilliseconds);
    } else {
      var item = MediaItem(
          id: metadata.title + metadata.artist,
          title: metadata.title,
          album: metadata.album,
          artist: metadata.album,
          duration: duration,
          artUri: Uri.parse(metadata.artwork)
      );
      mediaItem?.add(item);
      playMediaItem(item);
    }
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
    _audioPlayer.play();
  }

  void setPosition(int milliseconds) {
    _audioPlayer.seek(Duration(milliseconds: milliseconds));
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