# Musiche room service

The room service is deliberately separate from the existing proxy service. It
stores active rooms as folders and provides the HTTP/WebSocket protocol used by
the Web client.

```powershell
cd room-server
$env:ROOM_TOKEN_SECRET = "replace-with-a-long-random-secret"
$env:ROOM_COOKIE_KEY = "replace-with-a-different-long-random-secret"
$env:ROOM_SUPER_ADMIN_PASSWORD = "" # optional; empty disables it
$env:ROOM_LOG_TOKEN = "replace-with-a-log-view-token" # optional; empty disables the log API
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
  -e ROOM_LOG_TOKEN="replace-with-a-log-view-token" `
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

## Realtime transport fallback

The Web client normally connects through `/ws`. If the browser, CDN, or
reverse proxy blocks WebSocket, it automatically falls back to an HTTP NDJSON
stream at `GET /api/v1/realtime/stream` and sends room commands through
`POST /api/v1/realtime/command`. Both HTTP endpoints carry `memberToken` in
`Authorization: Bearer ...`; the token is not included in their URLs.

The fallback preference is stored per room-service address in browser local
storage. While an HTTP stream is active, the client performs a lightweight
`/ws?probe=1` check. A successful probe clears the preference so the next
connection uses WebSocket again. Probe connections do not join the room or
change its online member count.

The stream response sets `X-Accel-Buffering: no` and sends heartbeat events.
When adding another reverse proxy, keep streaming responses unbuffered and do
not impose a short read timeout on `/api/v1/realtime/stream`.

`ROOM_SUPER_ADMIN_PASSWORD` is optional. When non-empty, a member who has
already entered a room can use it in the administrator dialog to obtain
administrator control for that room. It is never sent to the Web client.
`ROOM_SUPER_PASSWORD` is accepted as a compatibility alias.

## Logs and WebSocket diagnostics

The service writes UTC logs to both stdout and a file. The default file is
`ROOM_DATA_DIR/logs/room-server.log` (`/data/logs/room-server.log` in the
Docker image). Files rotate at 20 MiB and keep five backups. Override these
values with `ROOM_LOG_FILE`, `ROOM_LOG_MAX_MB`, and `ROOM_LOG_BACKUPS`.

Set a non-empty `ROOM_LOG_TOKEN` to enable `GET /api/v1/logs`. It returns the
latest 256 KiB as plain text and accepts up to 2 MiB through the `bytes` query
parameter. Prefer the authorization header so the token does not appear in
browser history:

```powershell
Invoke-WebRequest `
  -Headers @{ Authorization = "Bearer replace-with-a-log-view-token" } `
  "https://example.com/api/v1/logs?bytes=524288"
```

For direct browser viewing, `/api/v1/logs?token=...` is also supported. Request
logs deliberately omit the query string, member token, cookies, and
authorization headers.

Each WebSocket attempt records a `request_id` and `connection_id`, proxy/TLS
headers, origin, user agent, authentication rejection code, connection time,
and disconnect reason. If a failed browser attempt produces neither an HTTP
`path="/ws"` entry nor `ws_connect_attempt`, the request did not reach the Go
service and the TLS/CDN or reverse-proxy WebSocket upgrade configuration should
be checked first. An HTTP `/ws` entry without `ws_connect_attempt` means the
WebSocket protocol handshake failed before application authentication.
