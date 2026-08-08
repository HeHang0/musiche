import type { RoomChatMessage, RoomSnapshot } from './room';

export const roomRelayProtocol = 1;

export interface RoomRelayOffer {
  version: number;
  kind: 'offer';
  sessionId: string;
  secret: string;
  roomId: string;
  roomName: string;
  chatKey?: string;
  description: RTCSessionDescriptionInit;
  expiresAt: number;
}

export interface RoomRelayAnswer {
  version: number;
  kind: 'answer';
  sessionId: string;
  secret: string;
  description: RTCSessionDescriptionInit;
}

export interface RoomRelayStateMessage {
  type: 'state';
  secret: string;
  snapshot: RoomSnapshot;
  chatMessages: RoomChatMessage[];
  lyric?: string;
  lyricsText?: string;
  sentAt: number;
}

export interface RoomRelayChatMessage {
  type: 'relay_chat';
  secret: string;
  relayId: string;
  nickname: string;
  avatar?: string;
  content: string;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function encodeRoomRelayPayload(payload: RoomRelayOffer | RoomRelayAnswer) {
  return bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
}

export function decodeRoomRelayPayload<T extends RoomRelayOffer | RoomRelayAnswer>(
  value: string
) {
  const input = value.trim();
  const raw = /^https?:\/\//i.test(input)
    ? new URL(input).hash.replace(/^#relay=/, '')
    : input.replace(/^#?relay=/, '');
  return JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(raw.trim()))
  ) as T;
}

export function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('收集局域网连接信息超时'));
    }, 15000);
    const change = () => {
      if (peer.iceGatheringState !== 'complete') return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', change);
    };
    peer.addEventListener('icegatheringstatechange', change);
  });
}

export function randomRelaySecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return bytesToBase64Url(bytes);
}
