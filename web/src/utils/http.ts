import { AudioPlayer } from './audio';
import { ProxyRequestData } from './type';
import { webView2Services } from './utils';
const musicRouterPrefix = localStorage.getItem('musiche-router-prefix');
const history = musicRouterPrefix ? '/' + musicRouterPrefix : '';

const httpAddress = import.meta.env.DEV ? '127.0.0.1:54621' : location.host;
const proxyAddress =
  (!webView2Services.enabled &&
    localStorage.getItem('musiche-proxy-address')) ||
  `//${httpAddress}/proxy`;
const useLocalAudio = !webView2Services.enabled;
var localAudio: AudioPlayer | null = null;
if (useLocalAudio) {
  localAudio = new AudioPlayer();
}

export function httpProxy(prd: ProxyRequestData): Promise<Response> {
  prd.method = prd.method || 'GET';
  return fetch(proxyAddress, {
    method: 'POST',
    body: JSON.stringify(prd),
    redirect: prd.allowAutoRedirect === false ? 'manual' : undefined
  });
}

export function parseHttpProxyAddress(url: string): string {
  return `${proxyAddress}?url=${encodeURIComponent(url)}`;
}

export function parseMusicFileImageAddress(path: string): string {
  if (!path) return '';
  return `//${httpAddress}/image?path=${encodeURIComponent(path)}`;
}

export async function musicOperate(
  url: string,
  data?: string,
  headers?: HeadersInit
): Promise<string | any> {
  if (url === '/version') {
    const res = await fetch(`//${httpAddress}${history}${url}`);
    return await res.text();
  } else if (useLocalAudio) {
    const route = url.substring(1);
    try {
      return localAudio?.process(route, data);
    } catch {
      return {};
    }
  } else {
    var text = '';
    try {
      const res = await fetch(`//${httpAddress}${history}${url}`, {
        method: 'POST',
        body: data,
        headers: headers
      });
      text = await res.text();
      return JSON.parse(text);
    } catch {
      return text || {};
    }
  }
}

export interface CommunicationClient {
  readyState: number;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
}

export function wsClient(
  onMessage: (message: string) => void,
  onClose: () => void
): CommunicationClient {
  if (useLocalAudio) {
    localAudio?.setOnMessage(onMessage);
    return {
      readyState: 3,
      send: (_data: string | Blob | ArrayBufferView | ArrayBufferLike) => {}
    };
  }
  // 创建 WebSocket 对象并指定服务器地址
  var socket = new WebSocket(
    `${
      location.protocol.startsWith('https') ? 'wss' : 'ws'
    }://${httpAddress}/ws`
  );

  // 当连接成功时触发
  socket.addEventListener('open', function () {
    console.log('WebSocket 已连接');
  });

  // 当收到消息时触发
  socket.addEventListener('message', function (event) {
    if (!onMessage) return;
    try {
      onMessage(JSON.parse(event.data));
    } catch (error) {
      onMessage(event.data);
    }
  });

  // 当连接关闭时触发
  socket.addEventListener('close', function () {
    onClose && onClose();
  });

  // 当发生错误时触发
  socket.addEventListener('error', function () {
    socket.close();
  });
  return {
    get readyState() {
      return socket.readyState;
    },
    send: socket.send.bind(socket)
  };
}
