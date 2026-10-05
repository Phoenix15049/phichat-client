/**
 * Wire format of an encrypted message body (checked by the server too):
 *   v2:{senderKeyId}:{recipientKeyId}:{base64(iv || ciphertext || tag)}
 * The header is authenticated as AES-GCM additional data, so the key ids cannot be altered.
 * The plaintext is a JSON envelope: the text plus, for attachments, the file's key and metadata.
 */
import { fromBase64, fromUtf8, toBase64, utf8 } from './bytes'
import { E2eeError, openBytes, sealBytes } from './primitives'

export type FileMeta = {
  /** base64 AES-256-GCM key of the uploaded ciphertext. */
  key: string
  iv: string
  name: string
  mime: string
  size: number
}

export type MessageEnvelope = {
  text: string
  file?: FileMeta
}

export type MessageHeader = {
  senderKeyId: string
  recipientKeyId: string
  sealed: Uint8Array<ArrayBuffer>
}

const PATTERN = /^v2:([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{22}):([A-Za-z0-9+/]+={0,2})$/

export function parseMessage(raw: string | null | undefined): MessageHeader | null {
  const match = raw ? PATTERN.exec(raw) : null
  if (!match) return null

  try {
    return { senderKeyId: match[1], recipientKeyId: match[2], sealed: fromBase64(match[3]) }
  } catch {
    return null
  }
}

const headerOf = (senderKeyId: string, recipientKeyId: string) => `v2:${senderKeyId}:${recipientKeyId}`

export async function sealMessage(
  key: CryptoKey,
  senderKeyId: string,
  recipientKeyId: string,
  envelope: MessageEnvelope
): Promise<string> {
  const header = headerOf(senderKeyId, recipientKeyId)
  const sealed = await sealBytes(key, utf8(JSON.stringify(envelope)), utf8(header))
  return `${header}:${toBase64(sealed)}`
}

export async function openMessage(key: CryptoKey, header: MessageHeader): Promise<MessageEnvelope> {
  const plain = await openBytes(key, header.sealed, utf8(headerOf(header.senderKeyId, header.recipientKeyId)))
  return parseEnvelope(fromUtf8(plain))
}

function parseEnvelope(json: string): MessageEnvelope {
  let value: any
  try {
    value = JSON.parse(json)
  } catch {
    throw new E2eeError('invalid_envelope')
  }

  if (!value || typeof value !== 'object' || typeof value.text !== 'string') {
    throw new E2eeError('invalid_envelope')
  }

  const envelope: MessageEnvelope = { text: value.text }
  const file = value.file

  if (file != null) {
    const valid =
      typeof file === 'object' &&
      typeof file.key === 'string' &&
      typeof file.iv === 'string' &&
      typeof file.name === 'string' &&
      typeof file.mime === 'string' &&
      Number.isFinite(file.size)

    if (!valid) throw new E2eeError('invalid_envelope')

    envelope.file = {
      key: file.key,
      iv: file.iv,
      // Never trust names from the other side for paths: keep only the last segment.
      name: String(file.name).split(/[\\/]/).pop()!.slice(0, 255) || 'file',
      mime: String(file.mime).slice(0, 255),
      size: Math.max(0, Math.floor(file.size))
    }
  }

  return envelope
}
