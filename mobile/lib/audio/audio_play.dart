import 'dart:async';
import 'dart:io';

import 'package:just_audio/just_audio.dart';
import 'package:musiche/utils/android_channel.dart';

import 'media_metadata.dart';

class AudioPlay {
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
    onDurationChanged.listen(_onDurationChanged);
    onPositionChanged.listen(_onPositionChanged);
    onPlayerStateChanged.listen(_onPlayerStateChanged);
  }

  _onPlayerStateChanged(PlayerState state) async {
    if(metadata == null) return;
    setMediaMeta(metadata!);
  }

  Future<void> _onPositionChanged(Duration position) async {
    AndroidChannel.setMediaPosition(playing, position.inMilliseconds);
  }

  Future<void> _onDurationChanged(Duration? duration) async {
    if(metadata == null || _audioPlayer.duration == null) return;
    AndroidChannel.setMediaMetadata(metadata!, playing, _audioPlayer.position.inMilliseconds, _audioPlayer.duration!.inMilliseconds);
  }

  Future<void> setMediaMeta(MediaMetadata metadata) async {
    this.metadata = metadata;
    Duration? duration = _audioPlayer.duration;
    if(duration == null || duration.inMilliseconds == 0){
      return;
    }
    AndroidChannel.setMediaMetadata(metadata, playing, _audioPlayer.position.inMilliseconds, duration.inMilliseconds);
  }
  void pause() {
    _audioPlayer.pause();
  }

  Future<void> play(String url) async {
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