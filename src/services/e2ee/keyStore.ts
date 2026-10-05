/**
 * This device's identity keys, kept in IndexedDB. The private key is stored as a
 * non-extractable CryptoKey: pages can use it, but its bytes cannot be read back out.
 * When IndexedDB is unavailable (some private modes) keys live in memory for the session.
 */
import type { IdentityKeyPair } from './primitives'

type StoredIdentity = IdentityKeyPair & { userId: string }

const DB_NAME = 'phichat-e2ee'
const STORE = 'identity'

const memory = new Map<string, StoredIdentity>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'userId' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    if (!db) return reject(new Error('IndexedDB unavailable'))
    const request = action(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

export async function loadIdentity(userId: string): Promise<IdentityKeyPair | null> {
  try {
    const stored = await run<StoredIdentity | undefined>('readonly', store => store.get(userId))
    if (stored?.privateKey) return { keyId: stored.keyId, publicKeySpki: stored.publicKeySpki, privateKey: stored.privateKey }
    return null
  } catch {
    return memory.get(userId) ?? null
  }
}

export async function saveIdentity(userId: string, identity: IdentityKeyPair): Promise<void> {
  const record: StoredIdentity = { userId, ...identity }
  memory.set(userId, record)
  try {
    await run('readwrite', store => store.put(record))
    memory.delete(userId)
  } catch {
    // Memory only: the user restores from the backup again next session.
  }
}

export async function deleteIdentity(userId: string): Promise<void> {
  memory.delete(userId)
  try { await run('readwrite', store => store.delete(userId)) } catch {}
}

/** Removes every identity on this device except `keepUserId` (another account's leftovers). */
export async function deleteOtherIdentities(keepUserId: string | null): Promise<void> {
  for (const id of [...memory.keys()]) if (id !== keepUserId) memory.delete(id)
  try {
    const ids = await run<IDBValidKey[]>('readonly', store => store.getAllKeys())
    for (const id of ids) {
      if (id !== keepUserId) await run('readwrite', store => store.delete(id))
    }
  } catch {}
}
