import 'dart:io';

abstract class IHandler {
  handle(HttpRequest request);
}