import type { Music } from './type';
import { getRoomServerAddress } from './room-config';

export {
  getRoomServerAddress,
  hasRoomServerAddressConfigured,
  setRoomServerAddress
} from './room-config';

export interface RoomSummary {
  id: string;
  name: string;
  locked: boolean;
  chatEncrypted: boolean;
  onlineCount: number;
  maxMembers: number;
  currentMusic?: Music;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  nickname: string;
  avatar?: string;
  fingerprintHash: string;
  firstJoinedAt: string;
  lastJoinedAt: string;
}

export interface RoomOnlineMember {
  id: string;
  nickname: string;
  avatar?: string;
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
  encrypted?: string;
  decryptionFailed?: boolean;
  avatar?: string;
  system?: boolean;
  createdAt: string;
}

export interface RoomState {
  version: number;
  current?: RoomQueueItem;
  queue: RoomQueueItem[];
  history?: RoomQueueItem[];
  playback: RoomPlaybackState;
  randomPlayback: boolean;
}

export interface RoomSnapshot {
  room: RoomSummary;
  state: RoomState;
  isAdmin: boolean;
  allowGuestQueue: boolean;
  memberId: string;
  nickname: string;
  avatar?: string;
  onlineMembers: RoomOnlineMember[];
  credentialSources: string[];
}

export interface RoomServiceConfig {
  maxRooms: number;
  maxMembersPerRoom: number;
  maxQueueItems: number;
  listPageSize: number;
  listMaxPageSize: number;
  credentialUploadEnabled: boolean;
  chatEncryptionSupported?: boolean;
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

export async function createRoomIdentity(): Promise<RoomIdentity> {
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
  let fingerprint = '';
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(rawFingerprint)
    );
    let binary = '';
    for (const byte of new Uint8Array(digest))
      binary += String.fromCharCode(byte);
    fingerprint = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } else {
    // Keep ordinary rooms working in older/insecure browser contexts. Modern
    // HTTPS and localhost sessions never download this compatibility chunk.
    const CryptoJS = (await import('crypto-js')).default;
    fingerprint = CryptoJS.enc.Base64.stringify(
      CryptoJS.SHA256(rawFingerprint)
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  return { visitorId, fingerprint };
}
