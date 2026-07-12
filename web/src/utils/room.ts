import type { Music } from './type';
import CryptoJS from 'crypto-js';

const addressKey = 'musiche-room-server-address';

export interface RoomSummary {
  id: string;
  name: string;
  locked: boolean;
  onlineCount: number;
  maxMembers: number;
  currentMusic?: Music;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  nickname: string;
  fingerprintHash: string;
  firstJoinedAt: string;
  lastJoinedAt: string;
}

export interface RoomQueueItem {
  id: string;
  music: Music;
  requestedBy: string;
  requestedName: string;
  requestedAt: string;
}

export interface RoomPlaybackState {
  playing: boolean;
  positionMs: number;
  updatedAt: string;
}

export interface RoomChatMessage {
  id: string;
  memberId: string;
  nickname: string;
  content: string;
  image?: string;
  createdAt: string;
}

export interface RoomState {
  version: number;
  current?: RoomQueueItem;
  queue: RoomQueueItem[];
  playback: RoomPlaybackState;
}

export interface RoomSnapshot {
  room: RoomSummary;
  state: RoomState;
  isAdmin: boolean;
  allowGuestQueue: boolean;
  memberId: string;
  nickname: string;
  credentialSources: string[];
}

export interface RoomServiceConfig {
  maxRooms: number;
  maxMembersPerRoom: number;
  maxQueueItems: number;
  listPageSize: number;
  listMaxPageSize: number;
  credentialUploadEnabled: boolean;
}

export interface RoomIdentity {
  visitorId: string;
  fingerprint: string;
}

export class RoomRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RoomRequestError';
    this.status = status;
  }
}

export function getRoomServerAddress() {
  const saved = localStorage.getItem(addressKey)?.trim();
  if (saved) return saved.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://127.0.0.1:8738';
  return `${location.protocol}//${location.hostname}`;
}

export function hasRoomServerAddressConfigured() {
  return Boolean(getRoomServerAddress()?.trim());
}

export function setRoomServerAddress(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) localStorage.removeItem(addressKey);
  else localStorage.setItem(addressKey, normalized);
}

export async function roomRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(getRoomServerAddress() + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new RoomRequestError(
      response.status,
      data.error || '歌房服务请求失败'
    );
  }
  return data as T;
}

export function roomWebSocketAddress(path: string) {
  const address = getRoomServerAddress();
  const protocol = address.startsWith('https://') ? 'wss://' : 'ws://';
  return protocol + address.replace(/^https?:\/\//, '') + path;
}

export function createRoomIdentity(): RoomIdentity {
  const idKey = 'musiche-room-visitor-id';
  let visitorId = localStorage.getItem(idKey);
  if (!visitorId) {
    visitorId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    localStorage.setItem(idKey, visitorId);
  }
  const rawFingerprint = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}`,
    navigator.hardwareConcurrency || ''
  ].join('|');
  // The raw browser characteristics are only used as input. Keep the value
  // sent to the room server short and URL-safe so it does not expose the full
  // fingerprint in WebSocket URLs or access logs.
  const digest = CryptoJS.SHA256(rawFingerprint);
  const fingerprint = CryptoJS.enc.Base64.stringify(digest)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return { visitorId, fingerprint };
}
