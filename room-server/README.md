# Musiche room service

The room service is deliberately separate from the existing proxy service. It
stores active rooms as folders and provides the HTTP/WebSocket protocol used by
the Web client.

```powershell
cd room-server
$env:ROOM_TOKEN_SECRET = "replace-with-a-long-random-secret"
$env:ROOM_COOKIE_KEY = "replace-with-a-different-long-random-secret"
$env:ROOM_SUPER_ADMIN_PASSWORD = "" # optional; empty disables it
go run .
```

It listens on `:8738` by default. Configure the Web client's **歌房服务地址**
as `http://127.0.0.1:8738` during local development.

Build and run with Docker:

```powershell
cd room-server
docker build -t musiche-room-server .
docker run -d --name musiche-room-server `
  -p 8738:8738 `
  -v musiche-room-data:/data `
  -e ROOM_TOKEN_SECRET="replace-with-a-long-random-secret" `
  -e ROOM_COOKIE_KEY="replace-with-a-different-long-random-secret" `
  -e ROOM_SUPER_ADMIN_PASSWORD="" `
  musiche-room-server
```

The `/data` volume stores room folders. Keep both secret environment variables
stable across container restarts; changing them invalidates administrator
tokens or makes existing encrypted Cookies unreadable.

Useful settings: `ROOM_DATA_DIR`, `ROOM_MAX_COUNT` (50),
`ROOM_MAX_MEMBERS_PER_ROOM` (30), `ROOM_EMPTY_TTL_MINUTES` (30), and
`ROOM_MAX_QUEUE_ITEMS` (100), `ROOM_MAX_CHAT_IMAGE_BYTES` (512 KiB),
`ROOM_MAX_TOTAL_CONNECTIONS` (1000).

`ROOM_COOKIE_KEY` is required before administrators can upload platform
cookies. Cookie values are AES-GCM encrypted at rest. The service resolves and
caches 网易云、咪咕与 QQ 音乐的 room playback URLs for five minutes. Room
state, permissions, chat, and sync events never depend on a platform resolver.
The same service also exposes the existing generic proxy behavior at
`/api/v1/proxy`, so the separate `proxy-server` process is not required for
the Musiche deployment.

`ROOM_SUPER_ADMIN_PASSWORD` is optional. When non-empty, a member who has
already entered a room can use it in the administrator dialog to obtain
administrator control for that room. It is never sent to the Web client.
`ROOM_SUPER_PASSWORD` is accepted as a compatibility alias.
