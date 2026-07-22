export interface RoomChatPlainPayload {
  content: string;
  image: string;
}

const keyBytes = 32;
const nonceBytes = 12;
const envelopeVersion = 'v1';
const sessionKeyPrefix = 'musiche-room-chat-key:';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function normalizeRoomId(roomId: string) {
  return roomId.trim().toUpperCase();
}

export function normalizeRoomChatKey(value: string) {
  const key = value.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return '';
  try {
    return decodeBase64Url(key).length === keyBytes ? key : '';
  } catch {
    return '';
  }
}

export function generateRoomChatKey() {
  const bytes = new Uint8Array(keyBytes);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function readRoomChatKeyFromHash(hash = location.hash) {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  return normalizeRoomChatKey(parameters.get('key') || '');
}

export function roomChatKeyHash(key: string) {
  const normalized = normalizeRoomChatKey(key);
  return normalized ? `#${new URLSearchParams({ key: normalized })}` : '';
}

export function rememberRoomChatKey(roomId: string, key: string) {
  const normalized = normalizeRoomChatKey(key);
  if (!normalized) return false;
  try {
    sessionStorage.setItem(sessionKeyPrefix + normalizeRoomId(roomId), normalized);
  } catch {
    // The URL fragment remains the source of truth when session storage is
    // unavailable (for example in a restricted embedded browser).
  }
  return true;
}

export function rememberedRoomChatKey(roomId: string) {
  try {
    return normalizeRoomChatKey(
      sessionStorage.getItem(sessionKeyPrefix + normalizeRoomId(roomId)) || ''
    );
  } catch {
    return '';
  }
}

async function importRoomChatKey(key: string) {
  const normalized = normalizeRoomChatKey(key);
  if (!normalized) throw new Error('聊天加密密钥无效');
  return crypto.subtle.importKey(
    'raw',
    decodeBase64Url(normalized),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function additionalData(roomId: string) {
  return encoder.encode(`musiche-room-chat:${normalizeRoomId(roomId)}`);
}

export async function encryptRoomChatPayload(
  roomId: string,
  key: string,
  payload: RoomChatPlainPayload
) {
  const nonce = new Uint8Array(nonceBytes);
  crypto.getRandomValues(nonce);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: additionalData(roomId),
      tagLength: 128
    },
    await importRoomChatKey(key),
    encoder.encode(JSON.stringify(payload))
  );
  return `${envelopeVersion}.${encodeBase64Url(nonce)}.${encodeBase64Url(
    new Uint8Array(encrypted)
  )}`;
}

export async function decryptRoomChatPayload(
  roomId: string,
  key: string,
  envelope: string
): Promise<RoomChatPlainPayload> {
  const [version, encodedNonce, encodedCiphertext, ...rest] = envelope.split('.');
  if (
    version !== envelopeVersion ||
    rest.length > 0 ||
    !/^[A-Za-z0-9_-]{16}$/.test(encodedNonce || '') ||
    !/^[A-Za-z0-9_-]+$/.test(encodedCiphertext || '')
  )
    throw new Error('不支持的聊天密文格式');
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64Url(encodedNonce),
      additionalData: additionalData(roomId),
      tagLength: 128
    },
    await importRoomChatKey(key),
    decodeBase64Url(encodedCiphertext)
  );
  const payload = JSON.parse(decoder.decode(decrypted));
  return {
    content: typeof payload?.content === 'string' ? payload.content : '',
    image: typeof payload?.image === 'string' ? payload.image : ''
  };
}
