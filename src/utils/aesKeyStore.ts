import { importAESKey, exportAESKey } from '../services/crypto';

const STORAGE_KEY_PREFIX = 'aeskey_';

export async function saveAESKey(userId: string, key: CryptoKey): Promise<void> {
  const exported = await exportAESKey(key)
  const base64 = btoa(String.fromCharCode(...exported))
  localStorage.setItem(STORAGE_KEY_PREFIX + userId, base64)
}

export async function loadAESKey(userId: string): Promise<CryptoKey | null> {
  const base64 = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
  if (!base64) return null;
  return await importAESKey(base64);
}

export function hasAESKey(userId: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PREFIX + userId) !== null;
}

export function deleteAESKey(userId: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
}
