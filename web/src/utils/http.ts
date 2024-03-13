import { AudioPlayer } from './audio';
import { ProxyRequestData } from './type';
import { webView2Services } from './utils';
const musicRouterPrefix = localStorage.getItem('musiche-router-prefix');
const history = musicRouterPrefix ? '/' + musicRouterPrefix : '';

export const httpAddress = import.meta.env.DEV
  ? '127.0.0.1:54621'
  : location.host;
const proxyAddress =
  (!webView2Services.enabled &&
    localStorage.getItem('musiche-proxy-address')) ||
  `//${httpAddress}/proxy`;
let useLocalAudio = !webView2Services.enabled;
var localAudio: AudioPlayer | null = null;
fetch(`//${httpAddress}/config`)
  .then(r => r.json())
  .then(r => {
    if (r.remote) useLocalAudio = false;
  });

export function setRemoteMode(remote: boolean) {
  useLocalAudio = !remote;
}
export function httpProxy(prd: ProxyRequestData): Promise<Response> {
  prd.method = prd.method || 'GET';
  return fetch(proxyAddress, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

let theme = -1;
let updateThemeDelay: any = null;
export async function updateTheme(themeValue?: number) {
  if (themeValue != null && themeValue >= 0) {
    theme = themeValue;
  }
  if (theme < 0) return;
  clearTimeout(updateThemeDelay);
  if (themeValue == null) {
    musicOperate('/theme?theme=' + theme);
  } else {
    updateThemeDelay = setTimeout(
      () => musicOperate('/theme?theme=' + theme),
      100
    );
  }
}
function onVisibilityChange() {
  if (document.visibilityState == 'visible') {
    updateTheme();
  }
}
if (webView2Services.enabled) {
  document.addEventListener('visibilitychange', onVisibilityChange);
}

export async function musicOperate(
  url: string,
  data?: string,
  headers?: HeadersInit
): Promise<string | any> {
  if (url === '/version') {
    try {
      const res = await fetch(`//${httpAddress}${history}${url}`);
      return await res.text();
    } catch {
      return '';
    }
  } else if (useLocalAudio && url !== '/config') {
    const route = url.substring(1);
    try {
      if (!localAudio) localAudio = new AudioPlayer();
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
  onClose: () => void,
  onOpen?: () => void
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
    console.log('WebSocket connected');
    onOpen && onOpen();
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
    console.log('WebSocket closed');
    onClose && onClose();
  });

  // 当发生错误时触发
  socket.addEventListener('error', function (error) {
    console.error('WebSocket error', error);
    socket.close();
    // onClose && onClose();
  });
  return {
    get readyState() {
      return socket.readyState;
    },
    send: socket.send.bind(socket)
  };
}
