/**
 * Wire format of an encrypted group message (checked by the server too):
 *   g1:{senderKeyId}:{keyId}.{wrappedKey},{keyId}.{wrappedKey},...:{base64(iv || ciphertext || tag)}
 *
 * The JSON envelope is encrypted once with a random AES-256-GCM message key. That key is then
 * wrapped (AES-GCM) for every member with the pairwise key of the sender and that member
 * (ECDH + HKDF, label GROUP_KEY_WRAP_INFO), so only members at the time of sending can read it,
 * and each of them knows who sent it: nobody else could have made their wrapped key.
 *
 * Additional data binds the content to the group and the sender key, and every wrapped key to the
 * group, both key ids and a hash of the content, so a member who knows the message key still
 * cannot pass off altered content as the sender's.
 */
import { fromBase64, fromUtf8, randomBytes, toBase64, utf8 } from './bytes'
import { parseEnvelope, type MessageEnvelope } from './messageCodec'
import { E2eeError, openBytes, sealBytes } from './primitives'

export const GROUP_PREFIX = 'g1:'

const KEY_ID = /^[A-Za-z0-9_-]{22}$/
const WRAPPED = /^[A-Za-z0-9+/]{80}$/
const PAYLOAD = /^[A-Za-z0-9+/]+={0,2}$/

export type GroupHeader = {
  senderKeyId: string
  /** Wrapped message key per recipient key id. */
  wrapped: Map<string, string>
  payload: string
}

export type GroupRecipient = {
  keyId: string
  /** The pairwise wrap key of the sender and this recipient. */
  wrapKey: CryptoKey
}

export function isGroupMessage(raw: string | null | undefined): boolean {
  return !!raw && raw.startsWith(GROUP_PREFIX)
}

export function parseGroupMessage(raw: string | null | undefined): GroupHeader | null {
  if (!isGroupMessage(raw)) return null
  const parts = raw!.split(':')
  if (parts.length !== 4 || !KEY_ID.test(parts[1]) || !PAYLOAD.test(parts[3])) return null

  const wrapped = new Map<string, string>()
  for (const entry of parts[2].split(',')) {
    const [keyId, key, extra] = entry.split('.')
    if (extra !== undefined || !KEY_ID.test(keyId) || !WRAPPED.test(key ?? '') || wrapped.has(keyId)) return null
    wrapped.set(keyId, key)
  }

  return { senderKeyId: parts[1], wrapped, payload: parts[3] }
}

const contentAad = (groupId: string, senderKeyId: string) => utf8(`g1|${groupId}|${senderKeyId}`)

const wrapAad = (groupId: string, senderKeyId: string, recipientKeyId: string, contentHash: string) =>
  utf8(`g1|wrap|${groupId}|${senderKeyId}|${recipientKeyId}|${contentHash}`)

async function contentHashOf(payload: Uint8Array<ArrayBuffer>): Promise<string> {
  return toBase64(await crypto.subtle.digest('SHA-256', payload))
}

export async function sealGroupMessage(
  groupId: string,
  senderKeyId: string,
  recipients: GroupRecipient[],
  envelope: MessageEnvelope
): Promise<string> {
  const rawKey = randomBytes(32)
  const messageKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
  const payload = await sealBytes(messageKey, utf8(JSON.stringify(envelope)), contentAad(groupId, senderKeyId))
  const hash = await contentHashOf(payload)

  const entries = await Promise.all(recipients.map(async recipient => {
    const wrapped = await sealBytes(recipient.wrapKey, rawKey, wrapAad(groupId, senderKeyId, recipient.keyId, hash))
    return `${recipient.keyId}.${toBase64(wrapped)}`
  }))

  rawKey.fill(0)
  return `${GROUP_PREFIX}${senderKeyId}:${entries.join(',')}:${toBase64(payload)}`
}

/** Decrypts with `wrapKey`, the pairwise key of the sender's key and `myKeyId`. */
export async function openGroupMessage(
  groupId: string,
  header: GroupHeader,
  myKeyId: string,
  wrapKey: CryptoKey
): Promise<MessageEnvelope> {
  const wrapped = header.wrapped.get(myKeyId)
  if (!wrapped) throw new E2eeError('not_a_recipient')

  const payload = fromBase64(header.payload)
  const hash = await contentHashOf(payload)
  const rawKey = await openBytes(wrapKey, fromBase64(wrapped), wrapAad(groupId, header.senderKeyId, myKeyId, hash))
  const messageKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  rawKey.fill(0)

  const plain = await openBytes(messageKey, payload, contentAad(groupId, header.senderKeyId))
  return parseEnvelope(fromUtf8(plain))
}
