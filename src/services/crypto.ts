

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


export async function decryptAES(key: CryptoKey, base64: string): Promise<string | null> {
  const binary = atob(base64)
  const data = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i)
  }

  const iv = data.slice(0, 12)
  const ciphertext = data.slice(12)

  console.log('🧪 Running AES decryption...')
  console.log('🔑 Key:', key)
  console.log('🔁 IV:', iv)
  console.log('📦 Ciphertext:', ciphertext)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    console.log('📦 Decrypted in decryptAES:', decrypted)
    return new TextDecoder().decode(decrypted)
  } catch (err) {
    console.error('❌ Decryption failed:', err)
    return null
  }
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