import { sendMessageWithFileFD } from '../../services/api'
import type { FileMeta, MessageEnvelope } from '../../services/e2ee/messageCodec'
import { E2eeError, sealFile } from '../../services/e2ee/primitives'

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
export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new E2eeError('file_too_large')

  const sealed = await sealFile(file)
  return {
    blob: sealed.blob,
    meta: {
      key: sealed.key,
      iv: sealed.iv,
      name: file.name || 'file',
      mime: file.type || 'application/octet-stream',
      size: file.size
    }
  }
}

/** Sends an encrypted attachment with its caption (re-encrypted if the peer's key changed). */
export function sendAttachment(
  sealAndSend: SealAndSend,
  peerId: string,
  attachment: PreparedAttachment,
  options: { caption: string; clientId: string; replyToMessageId?: string | null }
): Promise<void> {
  return sealAndSend(peerId, { text: options.caption, file: attachment.meta }, async body => {
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
