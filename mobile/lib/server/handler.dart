import 'package:musiche/audio/music_item.dart';

import '../audio/audio_play.dart';
import '../utils/utils.dart';

class Handler {
  late AudioPlay audioPlay;
  Handler(this.audioPlay);

  Future<Map<String, dynamic>> getStatus({Duration? position, Duration? duration}) async {
    position ??= await audioPlay.currentPosition();
    duration ??= await audioPlay.duration();
    int progress = await audioPlay.getProgress(position: position, duration: duration);
    Map<String, dynamic> data = <String, dynamic>{
      "volume": audioPlay.volume,
      "currentTime": formatDuration(position),
      "totalTime": formatDuration(duration),
      "playing": audioPlay.playing,
      "stopped": audioPlay.stopped,
      "progress": progress
    };
    MusicItem? music = audioPlay.getCurrentMusic();
    if(music != null) {
      data["id"] = music.id;
      data["type"] = music.type;
    }
    Map<String, dynamic> result = <String, dynamic>{
      "data": data
    };
    return result;
  }
}