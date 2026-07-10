# Musiche room service

The room service is deliberately separate from the existing proxy service. It
stores active rooms as folders and provides the HTTP/WebSocket protocol used by
the Web client.

```powershell
cd room-server
$env:ROOM_TOKEN_SECRET = "replace-with-a-long-random-secret"
$env:ROOM_COOKIE_KEY = "replace-with-a-different-long-random-secret"
go run .
```

It listens on `:8738` by default. Configure the Web client's **歌房服务地址**
as `http://127.0.0.1:8738` during local development.

Useful settings: `ROOM_DATA_DIR`, `ROOM_MAX_COUNT` (50),
`ROOM_MAX_MEMBERS_PER_ROOM` (30), `ROOM_EMPTY_TTL_MINUTES` (30), and
`ROOM_MAX_QUEUE_ITEMS` (100), `ROOM_MAX_CHAT_IMAGE_BYTES` (512 KiB),
`ROOM_MAX_TOTAL_CONNECTIONS` (1000).

`ROOM_COOKIE_KEY` is required before administrators can upload platform
cookies. Cookie values are AES-GCM encrypted at rest. The service resolves and
caches 网易云、咪咕与 QQ 音乐的 room playback URLs for five minutes. Room
state, permissions, chat, and sync events never depend on a platform resolver.
