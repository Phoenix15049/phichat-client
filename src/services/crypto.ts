import { JSEncrypt } from 'jsencrypt'

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const crypt = new JSEncrypt({ default_key_size: '2048' })
  crypt.getKey()

  return {
    publicKey: crypt.getPublicKey() ?? '',
    privateKey: crypt.getPrivateKey() ?? '',
  }
}

export function decryptRSA(encryptedBase64: string, privateKeyPem: string): string | null {
  try {
    if (!encryptedBase64 || !privateKeyPem || !privateKeyPem.includes('PRIVATE KEY')) return null

    const decryptor = new JSEncrypt()
    decryptor.setPrivateKey(privateKeyPem)

    const decrypted = decryptor.decrypt(encryptedBase64)
    return typeof decrypted === 'string' ? decrypted : null
  } catch {
    return null
  }
}
