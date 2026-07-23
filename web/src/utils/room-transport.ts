import { getRoomServerAddress } from './room-config';

const fallbackStorageKey = 'musiche-room-realtime-http-fallback';
const connectionErrorCodes = new Set([
  'missing_room_id',
  'missing_member_token',
  'room_not_found',
  'connection_limit_reached',
  'invalid_member_token',
  'member_connect_failed',
  'room_full',
  'invalid_message',
  'connection_id_conflict',
  'realtime_connection_not_found'
]);

export interface RoomTransportClose {
  code: string;
  message: string;
}

export interface RoomTransportError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface RoomTransportHandlers {
  onOpen: () => void;
  onConnecting?: () => void;
  onMessage: (raw: string) => void;
  onClose: (event: RoomTransportClose) => void;
  onError?: (event: RoomTransportError) => void;
}

interface RealtimeServerError {
  code: string;
  message: string;
}

export class RoomRealtimeTransport {
  private readonly serverAddress = getRoomServerAddress();
  private readonly roomId: string;
  private readonly memberToken: string;
  private readonly handlers: RoomTransportHandlers;
  private webSocket: WebSocket | null = null;
  private streamAbort: AbortController | null = null;
  private streamConnectionId = '';
  private probeSocket: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private commandQueue: Promise<void> = Promise.resolve();
  private activeTransport: 'websocket' | 'http-stream' | '' = '';
  private started = false;
  private closed = false;
  private terminalNotified = false;

  constructor(
    roomId: string,
    memberToken: string,
    handlers: RoomTransportHandlers
  ) {
    this.roomId = roomId;
    this.memberToken = memberToken;
    this.handlers = handlers;
  }

  start() {
    if (this.started || this.closed) return;
    this.started = true;
    if (this.prefersHTTPStream()) {
      void this.startHTTPStream();
      this.scheduleWebSocketProbe(1000);
    } else this.startWebSocket();
  }

  isOpen() {
    if (this.activeTransport === 'websocket')
      return this.webSocket?.readyState === WebSocket.OPEN;
    return (
      this.activeTransport === 'http-stream' &&
      Boolean(this.streamAbort) &&
      !this.streamAbort?.signal.aborted
    );
  }

  send(command: Record<string, unknown>) {
    if (this.activeTransport === 'websocket') {
      const socket = this.webSocket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(command));
        return true;
      } catch (error) {
        console.warn('[在线歌房] 实时消息发送失败，准备切换备用通道', error);
        socket.close();
        return false;
      }
    }
    if (this.activeTransport !== 'http-stream' || !this.streamConnectionId)
      return false;
    const connectionId = this.streamConnectionId;
    this.commandQueue = this.commandQueue.then(() =>
      this.postHTTPCommand(connectionId, command)
    );
    return true;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopHeartbeat();
    this.clearProbeTimer();
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.streamConnectionId = '';
    this.webSocket?.close();
    this.webSocket = null;
    this.probeSocket?.close();
    this.probeSocket = null;
    this.activeTransport = '';
  }

  private startWebSocket() {
    if (this.closed) return;
    this.handlers.onConnecting?.();
    const query = new URLSearchParams({
      roomId: this.roomId,
      memberToken: this.memberToken
    });
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.webSocketAddress('/ws?' + query));
    } catch (error) {
      this.fallbackToHTTP(error);
      return;
    }
    this.webSocket = socket;
    let serverFailure: RealtimeServerError | null = null;
    const timeout = setTimeout(() => {
      if (this.webSocket === socket) {
        socket.close();
        this.fallbackToHTTP(new Error('WebSocket 建连或首条消息超时'));
      }
    }, 10000);
    socket.onopen = () => {
      if (this.closed || this.webSocket !== socket) return;
      this.activeTransport = 'websocket';
      this.stopHeartbeat();
      this.startHeartbeat();
      this.handlers.onOpen();
    };
    socket.onmessage = event => {
      if (this.closed || this.webSocket !== socket) return;
      clearTimeout(timeout);
      const raw = String(event.data);
      const failure = this.readServerFailure(raw);
      if (failure && connectionErrorCodes.has(failure.code))
        serverFailure = failure;
      else this.clearHTTPFallback();
      this.handlers.onMessage(raw);
    };
    socket.onerror = () => {
      if (this.closed || this.webSocket !== socket || serverFailure) return;
      clearTimeout(timeout);
      this.fallbackToHTTP(new Error('WebSocket 连接失败'));
    };
    socket.onclose = event => {
      clearTimeout(timeout);
      if (this.closed || this.webSocket !== socket) return;
      this.webSocket = null;
      this.stopHeartbeat();
      this.activeTransport = '';
      if (serverFailure) {
        this.clearHTTPFallback();
        this.notifyClose(serverFailure.code, serverFailure.message);
        return;
      }
      this.fallbackToHTTP(
        new Error(event.reason || `WebSocket 非正常关闭（${event.code}）`)
      );
    };
  }

  private fallbackToHTTP(cause: unknown) {
    if (this.closed || this.activeTransport === 'http-stream') return;
    const socket = this.webSocket;
    this.webSocket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    this.stopHeartbeat();
    this.activeTransport = '';
    this.markHTTPFallback();
    this.handlers.onConnecting?.();
    console.warn('[在线歌房] WebSocket 不可用，切换到 HTTP 实时流', cause);
    void this.startHTTPStream();
    this.scheduleWebSocketProbe(5000);
  }

  private async startHTTPStream() {
    if (this.closed || this.streamAbort) return;
    this.handlers.onConnecting?.();
    const controller = new AbortController();
    const connectionId = this.createConnectionId();
    this.streamAbort = controller;
    this.streamConnectionId = connectionId;
    const query = new URLSearchParams({
      roomId: this.roomId,
      connectionId
    });
    try {
      const response = await fetch(
        `${this.serverAddress}/api/v1/realtime/stream?${query}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/x-ndjson',
            Authorization: `Bearer ${this.memberToken}`
          },
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal
        }
      );
      if (this.closed || this.streamAbort !== controller) return;
      if (!response.ok) {
        const failure = await this.readHTTPFailure(response);
        this.deliverServerFailure(failure);
        this.notifyClose(failure.code, failure.message);
        return;
      }
      if (!response.body) {
        throw new Error('浏览器不支持读取 HTTP 实时流');
      }
      this.activeTransport = 'http-stream';
      this.stopHeartbeat();
      this.startHeartbeat();
      this.handlers.onOpen();
      this.scheduleWebSocketProbe(5000);
      await this.readHTTPStream(response.body, controller);
      if (!this.closed && this.streamAbort === controller) {
        this.notifyError(
          'transport_closed',
          '歌房实时连接已断开，正在重新连接'
        );
        this.notifyClose('transport_closed', 'HTTP 实时流已断开');
      }
    } catch (error: any) {
      if (
        this.closed ||
        this.streamAbort !== controller ||
        error?.name === 'AbortError'
      )
        return;
      this.notifyError(
        'transport_error',
        '无法建立歌房实时连接，请检查服务地址或网络代理',
        error
      );
      this.notifyClose('transport_error', error?.message || 'HTTP 实时流连接失败');
    } finally {
      if (this.streamAbort === controller) {
        this.streamAbort = null;
        this.streamConnectionId = '';
        if (this.activeTransport === 'http-stream') this.activeTransport = '';
      }
    }
  }

  private async readHTTPStream(
    stream: ReadableStream<Uint8Array>,
    controller: AbortController
  ) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!this.closed && this.streamAbort === controller) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) this.handlers.onMessage(line);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) this.handlers.onMessage(buffer.trim());
  }

  private async postHTTPCommand(
    connectionId: string,
    command: Record<string, unknown>
  ) {
    if (
      this.closed ||
      this.activeTransport !== 'http-stream' ||
      this.streamConnectionId !== connectionId
    )
      return;
    try {
      const response = await fetch(
        `${this.serverAddress}/api/v1/realtime/command`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.memberToken}`
          },
          credentials: 'omit',
          signal: this.streamAbort?.signal,
          body: JSON.stringify({
            roomId: this.roomId,
            connectionId,
            command
          })
        }
      );
      if (!response.ok) {
        const failure = await this.readHTTPFailure(response);
        this.deliverServerFailure(failure);
        if (connectionErrorCodes.has(failure.code)) {
          this.streamAbort?.abort();
          this.notifyClose(failure.code, failure.message);
        }
      }
    } catch (error: any) {
      if (this.closed || error?.name === 'AbortError') return;
      this.notifyError(
        'command_transport_error',
        '歌房操作发送失败，请稍后重试',
        error
      );
    }
  }

  private startHeartbeat() {
    if (this.activeTransport !== 'websocket') return;
    this.heartbeatTimer = setInterval(() => {
      if (this.isOpen())
        this.send({ type: 'command', action: 'heartbeat' });
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleWebSocketProbe(delay: number) {
    this.clearProbeTimer();
    if (!this.prefersHTTPStream()) return;
    this.probeTimer = setTimeout(() => this.probeWebSocket(), delay);
  }

  private probeWebSocket() {
    if (this.closed || !this.prefersHTTPStream() || this.probeSocket) return;
    const query = new URLSearchParams({
      probe: '1',
      roomId: this.roomId,
      memberToken: this.memberToken
    });
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.webSocketAddress('/ws?' + query));
    } catch {
      return;
    }
    this.probeSocket = socket;
    const timeout = setTimeout(() => socket.close(), 8000);
    const cleanup = () => {
      clearTimeout(timeout);
      if (this.probeSocket === socket) this.probeSocket = null;
    };
    socket.onmessage = () => {
      if (this.closed || this.probeSocket !== socket) return;
      this.clearHTTPFallback();
      console.info('[在线歌房] WebSocket 探测恢复，下次连接将优先使用 WebSocket');
      cleanup();
      socket.close();
    };
    socket.onerror = () => {
      cleanup();
      if (socket.readyState < WebSocket.CLOSING) socket.close();
    };
    socket.onclose = cleanup;
  }

  private readServerFailure(raw: string): RealtimeServerError | null {
    try {
      const event = JSON.parse(raw);
      if (event?.type !== 'error' || !event?.code) return null;
      return {
        code: String(event.code),
        message:
          typeof event.data === 'string'
            ? event.data
            : event.data?.message || '歌房实时连接被拒绝'
      };
    } catch {
      return null;
    }
  }

  private async readHTTPFailure(
    response: Response
  ): Promise<RealtimeServerError> {
    const data = await response.json().catch(() => ({}));
    return {
      code: String(data.code || `http_${response.status}`),
      message: data.error || `歌房服务请求失败（${response.status}）`
    };
  }

  private deliverServerFailure(failure: RealtimeServerError) {
    this.handlers.onMessage(
      JSON.stringify({
        type: 'error',
        code: failure.code,
        data: failure.message
      })
    );
  }

  private notifyError(code: string, message: string, cause?: unknown) {
    this.handlers.onError?.({ code, message, cause });
  }

  private notifyClose(code: string, message: string) {
    if (this.closed || this.terminalNotified) return;
    this.terminalNotified = true;
    this.stopHeartbeat();
    this.handlers.onClose({ code, message });
  }

  private createConnectionId() {
    return (
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }

  private webSocketAddress(path: string) {
    const protocol = this.serverAddress.startsWith('https://')
      ? 'wss://'
      : 'ws://';
    return protocol + this.serverAddress.replace(/^https?:\/\//, '') + path;
  }

  private prefersHTTPStream() {
    try {
      return localStorage.getItem(fallbackStorageKey) === this.serverAddress;
    } catch {
      return false;
    }
  }

  private markHTTPFallback() {
    try {
      localStorage.setItem(fallbackStorageKey, this.serverAddress);
    } catch {
      // Storage can be disabled in privacy mode; the current connection can
      // still use HTTP even when the preference cannot be persisted.
    }
  }

  private clearHTTPFallback() {
    try {
      if (localStorage.getItem(fallbackStorageKey) === this.serverAddress)
        localStorage.removeItem(fallbackStorageKey);
    } catch {
      // Ignore unavailable browser storage.
    }
  }

  private clearProbeTimer() {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
  }
}
