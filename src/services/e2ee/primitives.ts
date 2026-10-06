/**
 * End-to-end encryption primitives (WebCrypto only).
 *
 * - Identity: one ECDH P-256 key pair per account. Its key id is the base64url of the first
 *   16 bytes of SHA-256(SPKI), which the server computes the same way.
 * - Conversation key: ECDH(my private, peer public) -> HKDF-SHA256 -> AES-256-GCM. Both sides
 *   derive the same key; it is bound to the two key ids, so a new identity means a new key.
 *   Group messages use the same derivation with another HKDF label, to wrap per-message keys.
 * - Backup: the PKCS#8 private key encrypted with AES-GCM under PBKDF2-SHA256(passphrase).
 * - Files: a random AES-256-GCM key per file; the key travels inside the encrypted message.
 */
import { concatBytes, fromBase64, randomBytes, toBase64, toBase64Url, utf8 } from './bytes'

const ECDH_PARAMS: EcKeyImportParams = { name: 'ECDH', namedCurve: 'P-256' }
const IV_BYTES = 12

export const BACKUP_KDF = 'PBKDF2-SHA256'
export const BACKUP_ITERATIONS = 600_000

export type IdentityKeyPair = {
  keyId: string
  publicKeySpki: string
  /** Non-extractable: usable for ECDH, but it can never be read back out of the browser. */
  privateKey: CryptoKey
}

export type KeyBackup = {
  ciphertext: string
  salt: string
  iv: string
  kdf: string
  iterations: number
}

export class E2eeError extends Error {
  readonly code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'E2eeError'
  }
}

// ---------- identity ----------

export async function keyIdOf(spki: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', spki))
  return toBase64Url(hash.subarray(0, 16))
}

/** Creates an identity; also returns the PKCS#8 bytes once, so they can be backed up. */
export async function generateIdentity(): Promise<{ identity: IdentityKeyPair; pkcs8: Uint8Array<ArrayBuffer> }> {
  const pair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits']) as CryptoKeyPair
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))

  return {
    identity: {
      keyId: await keyIdOf(spki),
      publicKeySpki: toBase64(spki),
      privateKey: await importPrivateKey(pkcs8)
    },
    pkcs8
  }
}

function importPrivateKey(pkcs8: Uint8Array<ArrayBuffer>, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH_PARAMS, extractable, ['deriveBits'])
}

/**
 * Imports a peer's public key and checks that it really is the key named by `expectedKeyId`
 * (key ids are hashes, so the server cannot hand out a different key under a known id).
 */
export async function importPeerPublicKey(publicKeySpki: string, expectedKeyId: string): Promise<CryptoKey> {
  const spki = fromBase64(publicKeySpki)
  if (await keyIdOf(spki) !== expectedKeyId) {
    throw new E2eeError('key_id_mismatch', 'Public key does not match its key id')
  }
  // WebCrypto rejects points that are not on the curve.
  return crypto.subtle.importKey('spki', spki, ECDH_PARAMS, false, [])
}

// ---------- conversation keys ----------

export const DIRECT_MESSAGE_INFO = 'phichat/v2/direct-message'
export const GROUP_KEY_WRAP_INFO = 'phichat/v2/group-key-wrap'

/**
 * The AES-GCM key shared by the owners of `myKeyId` and `peerKeyId`. `info` separates its uses:
 * private-chat messages, or wrapping group message keys.
 */
export async function deriveConversationKey(
  myPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  myKeyId: string,
  peerKeyId: string,
  info: string = DIRECT_MESSAGE_INFO
): Promise<CryptoKey> {
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublicKey }, myPrivateKey, 256)
  const hkdfKey = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey'])

  // Sorted so both sides use the same salt.
  const salt = utf8([myKeyId, peerKeyId].sort().join('|'))

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ---------- AES-GCM ----------

export async function sealBytes(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
  additionalData?: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = randomBytes(IV_BYTES)
  const params: AesGcmParams = additionalData ? { name: 'AES-GCM', iv, additionalData } : { name: 'AES-GCM', iv }
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(params, key, plaintext))
  return concatBytes(iv, ciphertext)
}

/** Throws (OperationError) when the key is wrong or the data was tampered with. */
export async function openBytes(
  key: CryptoKey,
  sealed: Uint8Array<ArrayBuffer>,
  additionalData?: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  if (sealed.length < IV_BYTES + 16) throw new E2eeError('ciphertext_too_short')
  const iv = sealed.subarray(0, IV_BYTES)
  const params: AesGcmParams = additionalData ? { name: 'AES-GCM', iv, additionalData } : { name: 'AES-GCM', iv }
  return new Uint8Array(await crypto.subtle.decrypt(params, key, sealed.subarray(IV_BYTES)))
}

// ---------- backup ----------

async function backupKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', utf8(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** The backup is bound to its key id, so it cannot be swapped for another key's backup. */
const backupAad = (keyId: string) => utf8(`phichat/backup/v1|${keyId}`)

export async function createBackup(pkcs8: Uint8Array<ArrayBuffer>, keyId: string, passphrase: string): Promise<KeyBackup> {
  const salt = randomBytes(16)
  const key = await backupKey(passphrase, salt, BACKUP_ITERATIONS)
  const sealed = await sealBytes(key, pkcs8, backupAad(keyId))

  return {
    ciphertext: toBase64(sealed.subarray(IV_BYTES)),
    iv: toBase64(sealed.subarray(0, IV_BYTES)),
    salt: toBase64(salt),
    kdf: BACKUP_KDF,
    iterations: BACKUP_ITERATIONS
  }
}

/**
 * Decrypts a backup and checks the private key belongs to `publicKeySpki`.
 * Throws E2eeError('wrong_passphrase') when the passphrase is wrong.
 */
export async function openBackup(
  backup: KeyBackup,
  keyId: string,
  publicKeySpki: string,
  passphrase: string
): Promise<{ identity: IdentityKeyPair; pkcs8: Uint8Array<ArrayBuffer> }> {
  if (backup.kdf !== BACKUP_KDF || !(backup.iterations > 0)) throw new E2eeError('unsupported_backup')

  const key = await backupKey(passphrase, fromBase64(backup.salt), backup.iterations)

  let pkcs8: Uint8Array<ArrayBuffer>
  try {
    pkcs8 = await openBytes(key, concatBytes(fromBase64(backup.iv), fromBase64(backup.ciphertext)), backupAad(keyId))
  } catch {
    throw new E2eeError('wrong_passphrase')
  }

  // The private key must match the published public key (PKCS#8 from WebCrypto carries it).
  const extractable = await importPrivateKey(pkcs8, true)
  const jwk = await crypto.subtle.exportKey('jwk', extractable)
  const publicKey = await crypto.subtle.importKey('spki', fromBase64(publicKeySpki), ECDH_PARAMS, true, [])
  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey)
  if (jwk.x !== publicJwk.x || jwk.y !== publicJwk.y) throw new E2eeError('backup_key_mismatch')

  return {
    identity: { keyId, publicKeySpki, privateKey: await importPrivateKey(pkcs8) },
    pkcs8
  }
}

// ---------- files ----------

export type SealedFile = { blob: Blob; key: string; iv: string }

/** Encrypts a file with a fresh key. The upload contains nothing but ciphertext. */
export async function sealFile(file: Blob): Promise<SealedFile> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = randomBytes(IV_BYTES)
  const data = new Uint8Array(await file.arrayBuffer())
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))

  return {
    blob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    key: toBase64(raw),
    iv: toBase64(iv)
  }
}

export async function openFile(ciphertext: ArrayBuffer, keyBase64: string, ivBase64: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', fromBase64(keyBase64), { name: 'AES-GCM' }, false, ['decrypt'])
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivBase64) }, key, ciphertext)
}

// ---------- safety numbers ----------

/**
 * A 60-digit code two people can compare to make sure no one swapped their keys.
 * It is the same on both sides because the two public keys are hashed in a fixed order.
 */
export async function safetyNumber(spkiA: string, spkiB: string): Promise<string[]> {
  const a = fromBase64(spkiA)
  const b = fromBase64(spkiB)
  const [first, second] = compareBytes(a, b) <= 0 ? [a, b] : [b, a]

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', concatBytes(utf8('phichat/safety/v1'), first, second)))

  const groups: string[] = []
  for (let i = 0; i < 12; i++) {
    // 5 bytes -> a 5-digit group (as in Signal's safety numbers).
    let value = 0
    for (let j = 0; j < 5; j++) value = value * 256 + digest[i * 5 + j]
    groups.push(String(value % 100000).padStart(5, '0'))
  }
  return groups
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

