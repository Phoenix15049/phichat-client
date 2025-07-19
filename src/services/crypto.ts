import { JSEncrypt } from 'jsencrypt'

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const crypt = new JSEncrypt({ default_key_size: '2048' })
  crypt.getKey()

  return {
    publicKey: crypt.getPublicKey() ?? '',
    privateKey: crypt.getPrivateKey() ?? '',
  }
}

export function encryptWithPublicKey(publicKey: string, data: Uint8Array): string {
  const crypt = new JSEncrypt()
  crypt.setPublicKey(publicKey)
  const encrypted = crypt.encrypt(btoa(String.fromCharCode(...data)))
  if (!encrypted) throw new Error('RSA encryption failed')
  return encrypted
}

export function decryptWithPrivateKey(privateKey: string, encrypted: string): Uint8Array {
  const crypt = new JSEncrypt()
  crypt.setPrivateKey(privateKey)
  const decrypted = crypt.decrypt(encrypted)
  if (!decrypted) throw new Error('RSA decryption failed')
  return Uint8Array.from(atob(decrypted), c => c.charCodeAt(0))
}


export async function encryptAES(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(text)

  if (!encoded || encoded.length === 0) {
    console.error('❌ encryptAES: Cannot encrypt empty or invalid string')
    throw new Error('Cannot encrypt empty string')
  }

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  const result = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), iv.byteLength)

  // 🔁 بهتره به Base64 به روشی دقیق‌تر encode بشه:
  return bufferToBase64(result)
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}


export async function decryptAES(key: CryptoKey, base64: string): Promise<string> {
  const binary = atob(base64)
  const data = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i)
  }

  const iv = data.slice(0, 12)
  const ciphertext = data.slice(12)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}






export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function exportAESKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(raw)
}

export async function importAESKey(base64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )
}


export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function encryptPrivateKeyWithPassword(privateKeyPEM: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKeyFromPassword(password, salt)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(privateKeyPEM)
  )

  // ترکیب salt + iv + data → base64
  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  result.set(salt, 0)
  result.set(iv, salt.length)
  result.set(new Uint8Array(ciphertext), salt.length + iv.length)

  return btoa(String.fromCharCode(...result))
}

export async function decryptPrivateKeyWithPassword(encryptedBase64: string, password: string): Promise<string> {
  try {
    const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
    const salt = data.slice(0, 16)
    const iv = data.slice(16, 28)
    const ciphertext = data.slice(28)

    const key = await deriveKeyFromPassword(password, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch (err) {
    console.error('❌ Decryption failed:', err)
    throw err
  }
}
