import { sendMessageWithFileFD } from '../../services/api'
import type { AlbumMeta, FileMeta, MessageEnvelope } from '../../services/e2ee/messageCodec'
import { E2eeError, sealFile } from '../../services/e2ee/primitives'
import { readAudioMeta } from '../audio/audioTags'

/** Plaintext limit: the server accepts 50 MB per request, and encryption adds a few bytes. */
export const MAX_ATTACHMENT_BYTES = 49_000_000

export type SealAndSend = (
  peerId: string,
  envelope: MessageEnvelope,
  send: (body: string) => Promise<unknown>
) => Promise<void>

export type PreparedAttachment = { meta: FileMeta; blob: Blob }

/**
 * Encrypts a file for upload. The server only ever receives the ciphertext; the key, name
 * and type travel inside the end-to-end encrypted message.
 */
export async function prepareAttachment(file: File, options?: { voice?: boolean }): Promise<PreparedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new E2eeError('file_too_large')

  const [sealed, details] = await Promise.all([sealFile(file), options?.voice ? {} : describeFile(file)])
  return {
    blob: sealed.blob,
    meta: {
      key: sealed.key,
      iv: sealed.iv,
      name: file.name || 'file',
      mime: file.type || 'application/octet-stream',
      size: file.size,
      ...details
    }
  }
}

/** What the recipient needs before downloading: the shape of a picture, the tags of a song. */
async function describeFile(file: File): Promise<Partial<FileMeta>> {
  try {
    if (file.type.startsWith('audio/')) return { audio: await readAudioMeta(file) }

    if (file.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return size
    }

    if (file.type.startsWith('video/')) return await videoSize(file)
  } catch {}
  return {}
}

function videoSize(file: File): Promise<Partial<FileMeta>> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (size: Partial<FileMeta>) => {
      URL.revokeObjectURL(url)
      resolve(size)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish({ width: video.videoWidth, height: video.videoHeight })
    video.onerror = () => finish({})
    video.src = url
  })
}

/** Sends an encrypted attachment with its caption (re-encrypted if the peer's key changed). */
export function sendAttachment(
  sealAndSend: SealAndSend,
  peerId: string,
  attachment: PreparedAttachment,
  options: { caption: string; clientId: string; replyToMessageId?: string | null; album?: AlbumMeta | null }
): Promise<void> {
  const envelope: MessageEnvelope = { text: options.caption, file: attachment.meta, ...(options.album ? { album: options.album } : {}) }

  return sealAndSend(peerId, envelope, async body => {
    const form = new FormData()
    form.append('receiverId', peerId)
    form.append('encryptedText', body)
    // A neutral name: the real one is only inside the encrypted message.
    form.append('file', attachment.blob, 'attachment.bin')
    if (options.replyToMessageId) form.append('replyToMessageId', options.replyToMessageId)
    form.append('clientId', options.clientId)
    await sendMessageWithFileFD(form)
  })
}
