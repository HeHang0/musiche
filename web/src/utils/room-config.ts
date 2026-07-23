import { StorageKey } from './storage';

const roomServiceConfigKey = 'musiche-' + StorageKey.RoomServerAddress;

export function getRoomServerAddress() {
  const saved = localStorage.getItem(roomServiceConfigKey)?.trim();
  if (saved) return saved.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://127.0.0.1:8738';
  return `${location.protocol}//${location.hostname}`;
}

export function hasRoomServerAddressConfigured() {
  return Boolean(getRoomServerAddress()?.trim());
}

export function setRoomServerAddress(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) localStorage.removeItem(roomServiceConfigKey);
  else localStorage.setItem(roomServiceConfigKey, normalized);
}
