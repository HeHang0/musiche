import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:id3tag/id3tag.dart';
import 'package:musiche/log/logger.dart';
import 'package:musiche/utils/android_channel.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import '../audio/audio_tag.dart';
import '../utils/os_version.dart';
import '../utils/utils.dart';

class FileHandler{
  static const String _tag = 'MusicheFileHandler';
  static Map<String, JavaScriptHandlerCallback> handlers = {
    "readFile": readFile,
    "writeFile": writeFile,
    "deleteFile": deleteFile,
    "fileExists": fileExists,
    "showSelectedDirectory": showSelectedDirectory,
    "showSelectedImage": showSelectedImage,
    "getMyMusicDirectory": getMyMusicDirectory,
    "listAllFiles": listAllFiles,
    "listAllAudios": listAllAudios,
  };
  static String readFile(List<dynamic> arguments){
    return '';
  }
  static void writeFile(List<dynamic> arguments){//String path, String text

  }
  static void deleteFile(List<dynamic> arguments) async {
  }
  static Future<bool> fileExists(List<dynamic> arguments) async {
    if(arguments.isNotEmpty || arguments[0] is String){
      return await File(arguments[0]).exists();
    }
    return false;
  }
  static Future<String?> showSelectedImage(List<dynamic> arguments) async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(type: FileType.image);
    if(result != null) {
      return result.files.first.path;
    }
    return null;
  }
  static Future<List<String>> showSelectedDirectory(List<dynamic> arguments) async {
    List<String> result = [];
    String? path = await FilePicker.platform.getDirectoryPath();
    if(path != null) {
      result.add(path);
    }
    return result;
  }

  static Future<String> getMyMusicDirectory(List<dynamic> arguments) async {
    if(!kIsWeb && Platform.isAndroid){
      var androidInfo = await OSVersion.androidInfo;
      var sdkInt = androidInfo?.version.sdkInt ?? 0;
      if(sdkInt < 33) {
        var status = await Permission.storage.status;
        if (!status.isGranted) {
          status = await Permission.storage.request();
        }
        if(!status.isGranted){
          return '';
        }
        final dir = await getExternalStorageDirectory();
        final rootDir = dir?.path.replaceFirst('/Android/data/com.picapico.musiche/files', '');
        return rootDir != null ? '$rootDir/Music' : '';
      }else {
        var status = await Permission.audio.status;
        if (!status.isGranted) {
          status = await Permission.audio.request();
        }
        if(!status.isGranted){
          return '';
        }
        return "Music";
      }
    }
    return '';
  }

  static List<String> listAllFiles(List<dynamic> arguments){//String path, bool recursive, bool onlyAudio
    List<String> result = [];
    return result;
  }

  static final Set<String> _audioExtensions = {"mp3", "wav", "flac", "wma", "ape", "m4a"};
  static Future<String> listAllAudios(List<dynamic> arguments) async {//String path, bool recursive
    if(arguments.length <= 1 || arguments[0] is! String || arguments[1] is! bool){
      return '';
    }
    if("Music" == arguments[0]){
      return jsonEncode(await AndroidChannel.getAllAudio());
    }
    List<String> files = await _listDirectory(Directory(arguments[0]), arguments[1]);
    List<Map<String, dynamic>> result = [];
    for(int i=0; i<files.length; i++){
      File f = File(files[i]);
      if(await f.exists()){
        final parser = ID3TagReader(f);
        final tag = await parser.readTag();
        AudioTag audioTag = AudioTag(
          id: f.path,
          name: tag.title ?? _fileName(f),
          singer: tag.artist ?? '',
          album: tag.album ?? '',
          length: tag.duration?.inMilliseconds ?? 0,
          duration: tag.duration != null ? formatDuration(tag.duration) : '',
          url: f.path,
        );
        result.add(audioTag.asMap());
      }
    }
    return jsonEncode(result);
  }

  static Future<List<String>> _listDirectory(Directory dir, bool recursive) async {
    List<String> result = [];
    var status = await Permission.storage.status;
    if (!status.isGranted) {
      await Permission.storage.request();
    }
    try{
      if(await dir.exists()){
        Stream<FileSystemEntity> files = dir.list(recursive: recursive);
        StreamSubscription<FileSystemEntity> subscription = files.listen((file) {
          if (file is File && _audioExtensions.contains(_getExtension(file.path))) {
            result.add(file.path);
          }
        });
        // 遍历该列表
        await subscription.asFuture();
      }
    }catch(e){
      Logger.e(_tag, "list directory err", error: e);
    }
    return result;
  }

  static String _getExtension(String filePath){
    List<String> parts = filePath.trim().split('.');
    return parts.isNotEmpty ? parts[parts.length - 1] : '';
  }

  static String _fileName(File file, {bool extension=false}){
    String fullName = file.uri.pathSegments.last;
    if(extension) return fullName;
    return fullName.replaceFirst(RegExp(r"\.\S+$"), '');
  }
}