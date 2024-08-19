import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

class OSVersion {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  static AndroidDeviceInfo? _androidInfo;
  static Future<AndroidDeviceInfo?> get androidInfo => _initAndroidInfo();

  static Future<AndroidDeviceInfo?> _initAndroidInfo() async {
    if(kIsWeb || !Platform.isAndroid) return null;
    _androidInfo ??= await _deviceInfo.androidInfo;
    return _androidInfo;
  }
}