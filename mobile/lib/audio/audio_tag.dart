

class AudioTag{
  String id;
  String name;
  String singer;
  String album;
  int length = 0;
  String duration;
  String url;
  AudioTag({this.id='', this.name='', this.singer='', this.album='', this.length=0, this.duration='', this.url=''});

  Map<String, dynamic> asMap(){
    Map<String, dynamic> result = {
      "id": id,
      "name": name,
      "singer": singer,
      "album": album,
      "length": length,
      "duration": duration,
      "url": url,
    };
    return result;
  }
}