/**
 * Wire format of an encrypted message body (checked by the server too):
 *   v2:{senderKeyId}:{recipientKeyId}:{base64(iv || ciphertext || tag)}
 * The header is authenticated as AES-GCM additional data, so the key ids cannot be altered.
 * The plaintext is a JSON envelope: the text plus, for attachments, the file's key and metadata.
 */
import { fromBase64, fromUtf8, toBase64, utf8 } from './bytes'
import { E2eeError, openBytes, sealBytes } from './primitives'

export type VoiceMeta = {
  /** Seconds. */
  duration: number
  /** Bar heights 0..31 for the waveform. */
  waveform: number[]
}

/** Tags of a music file, read by the sender. */
export type AudioMeta = {
  title?: string
  performer?: string
  /** Seconds. */
  duration?: number
  /** Small JPEG cover as a data: URL. */
  cover?: string
}

export type FileMeta = {
  /** base64 AES-256-GCM key of the uploaded ciphertext. */
  key: string
  iv: string
  name: string
  mime: string
  size: number
  /** Pixel size of an image or video, so an album can be laid out before it is decrypted. */
  width?: number
  height?: number
  /** Present for voice messages. */
  voice?: VoiceMeta
  /** Present for music files. */
  audio?: AudioMeta
}

/** Marks a message as one item of an album: the items are shown together as one message. */
export type AlbumMeta = {
  id: string
  index: number
  count: number
}

/** Made by the sender's client; the recipient never contacts the linked site. */
export type LinkPreviewMeta = {
  url: string
  siteName?: string
  title?: string
  description?: string
  /** Small JPEG thumbnail as a data: URL. */
  image?: string
}

export type MessageEnvelope = {
  text: string
  file?: FileMeta
  preview?: LinkPreviewMeta
  album?: AlbumMeta
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

export function parseEnvelope(json: string): MessageEnvelope {
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

    const voice = file.voice
    if (voice && typeof voice === 'object' && Number.isFinite(voice.duration) && Array.isArray(voice.waveform)) {
      envelope.file.voice = {
        duration: Math.min(3600, Math.max(0, Number(voice.duration))),
        waveform: voice.waveform.slice(0, 128).map((v: unknown) => Math.min(31, Math.max(0, Math.round(Number(v) || 0))))
      }
    }

    const pixels = (n: unknown) => (Number.isFinite(n) && (n as number) > 0 && (n as number) <= 40_000 ? Math.round(n as number) : undefined)
    const width = pixels(file.width)
    const height = pixels(file.height)
    if (width && height) {
      envelope.file.width = width
      envelope.file.height = height
    }

    const audio = parseAudio(file.audio)
    if (audio) envelope.file.audio = audio
  }

  const preview = parsePreview(value.preview)
  if (preview) envelope.preview = preview

  const album = parseAlbum(value.album)
  if (album) envelope.album = album

  return envelope
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined

const INLINE_IMAGE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/

/** Untrusted input from the other side, like everything else in the envelope. */
function parseAudio(value: any): AudioMeta | undefined {
  if (!value || typeof value !== 'object') return undefined

  const audio: AudioMeta = { title: text(value.title, 200), performer: text(value.performer, 200) }
  if (Number.isFinite(value.duration) && value.duration > 0) audio.duration = Math.min(86_400, Number(value.duration))
  if (typeof value.cover === 'string' && value.cover.length < 60_000 && INLINE_IMAGE.test(value.cover)) audio.cover = value.cover
  return audio
}

function parseAlbum(value: any): AlbumMeta | undefined {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(value.id)) return undefined
  if (!Number.isInteger(value.index) || !Number.isInteger(value.count)) return undefined
  if (value.count < 1 || value.count > 100 || value.index < 0 || value.index >= value.count) return undefined
  return { id: value.id, index: value.index, count: value.count }
}

/** Untrusted input from the other side: only http(s) links and small inline JPEG/PNG thumbnails. */
function parsePreview(value: any): LinkPreviewMeta | undefined {
  if (!value || typeof value !== 'object' || typeof value.url !== 'string') return undefined
  if (!/^https?:\/\//i.test(value.url) || value.url.length > 2048) return undefined

  const preview: LinkPreviewMeta = {
    url: value.url,
    siteName: text(value.siteName, 80),
    title: text(value.title, 200),
    description: text(value.description, 300)
  }
  if (typeof value.image === 'string' && value.image.length < 200_000 && INLINE_IMAGE.test(value.image)) {
    preview.image = value.image
  }
  return preview.title || preview.description ? preview : undefined
}
