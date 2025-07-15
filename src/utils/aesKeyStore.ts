import { importAESKey, exportAESKey } from '../services/crypto';

const STORAGE_KEY_PREFIX = 'aeskey_';

// ذخیره کلید برای یک کاربر خاص
export async function saveAESKey(userId: string, key: CryptoKey): Promise<void> {
  const exported = await exportAESKey(key);
  localStorage.setItem(STORAGE_KEY_PREFIX + userId, exported);
}

// بازیابی کلید برای یک کاربر خاص
export async function loadAESKey(userId: string): Promise<CryptoKey | null> {
  const base64 = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
  if (!base64) return null;
  return await importAESKey(base64);
}

// بررسی وجود کلید
export function hasAESKey(userId: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PREFIX + userId) !== null;
}

// حذف کلید (مثلاً هنگام logout یا reset)
export function deleteAESKey(userId: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
}
