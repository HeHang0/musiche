import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:musiche/server/server_manager.dart';
import 'package:musiche/webview.dart';

class ServerStatusPage extends StatefulWidget {
  const ServerStatusPage({super.key});

  @override
  State<ServerStatusPage> createState() => _ServerStatusPageState();
}

class _ServerStatusPageState extends State<ServerStatusPage> {
  List<String> _localIPs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchIPs();
  }

  Future<void> _fetchIPs() async {
    List<String> ips = [];
    try {
      final interfaces = await NetworkInterface.list();
      for (var interface in interfaces) {
        for (var addr in interface.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            ips.add(addr.address);
          }
        }
      }
    } catch (e) {
      // 忽略异常
    }
    if (mounted) {
      setState(() {
        _localIPs = ips;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final port = ServerManager.port;
    return Scaffold(
      backgroundColor: const Color(0xFF13131A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              // 顶部图标与标题
              const Center(
                child: Icon(
                  Icons.album_rounded,
                  size: 80,
                  color: Colors.blueAccent,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Musiche Server',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '跨平台音乐播放代理服务',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 40),
              // 服务运行状态卡片
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E26),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.green.withOpacity(0.3), width: 1),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      '服务运行中...',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // IP 地址列表卡片
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1E26),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '其他设备可通过以下地址访问网页版：',
                        style: TextStyle(
                          color: Colors.grey,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (_loading)
                        const Expanded(
                          child: Center(
                            child: CircularProgressIndicator(color: Colors.blueAccent),
                          ),
                        )
                      else if (_localIPs.isEmpty)
                        const Expanded(
                          child: Center(
                            child: Text(
                              '未检测到本地网络 IP，请检查 WiFi 连接。',
                              style: TextStyle(color: Colors.white70, fontSize: 14),
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            itemCount: _localIPs.length,
                            separatorBuilder: (context, index) => const Divider(color: Colors.white10),
                            itemBuilder: (context, index) {
                              final url = 'http://${_localIPs[index]}:$port';
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: SelectableText(
                                  url,
                                  style: const TextStyle(
                                    color: Colors.blueAccent,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                trailing: IconButton(
                                  icon: const Icon(Icons.copy_rounded, color: Colors.grey, size: 20),
                                  onPressed: () {
                                    Clipboard.setData(ClipboardData(text: url));
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('已复制到剪贴板'),
                                        duration: Duration(seconds: 2),
                                      ),
                                    );
                                  },
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              // 启动本地 Web UI 按钮
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => const WebViewApp()),
                  );
                },
                icon: const Icon(Icons.web_rounded),
                label: const Text('启动本地 Web UI (老旧设备可能卡顿/崩溃)'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blueAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
