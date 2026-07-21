import { toAbsoluteServerUrl } from '../config/server'
import { decryptAES } from '../services/crypto'
import type {
  ServerMessage,
  UiMessage,
  UiReaction
} from '../types/chat'

const EMPTY_MSG_MARKER = '\u200B'

type CipherSource = 'content' | 'text'

type MapServerMessageOptions = {
  aesKey: CryptoKey
  myId: string
  cipherSource: CipherSource
  decryptFailureText?: string
  fallbackSentAt?: string
  retryKey?: () => Promise<CryptoKey>
}

export function dedupeReactions(
  list: UiReaction[]
): UiReaction[] {
  const map = new Map<string, UiReaction>()

  for (const reaction of list) {
    const key = reaction.emoji.normalize('NFKC')
    const existing = map.get(key)

    if (!existing) {
      map.set(key, { ...reaction })
      continue
    }

    existing.count = reaction.count
    existing.mine =
      existing.mine || reaction.mine || false
  }

  return Array.from(map.values())
    .filter(reaction => reaction.count > 0)
}

function normalizeReactions(
  message: ServerMessage
): UiReaction[] {
  const reactions =
    message.reactions ??
    message.Reactions ??
    []

  return dedupeReactions(
    reactions.map(reaction => ({
      emoji: reaction.emoji || reaction.Emoji || '',
      count: reaction.count ?? reaction.Count ?? 0,
      mine: !!(reaction.mine ?? reaction.Mine)
    }))
  )
}

function getEncryptedValue(
  message: ServerMessage,
  source: CipherSource
): string {
  const content =
    message.encryptedContent ??
    message.EncryptedContent ??
    ''

  if (source === 'content') {
    return String(content)
  }

  return String(
    message.encryptedText ??
    message.EncryptedText ??
    content
  )
}

export async function mapServerMessage(
  message: ServerMessage,
  options: MapServerMessageOptions
): Promise<UiMessage> {
  const raw = getEncryptedValue(
    message,
    options.cipherSource
  )

  let decrypted = ''

  if (raw.trim()) {
    try {
      let value = await decryptAES(
        options.aesKey,
        raw
      )

      if (!value && options.retryKey) {
        const retryKey = await options.retryKey()

        if (retryKey !== options.aesKey) {
          value = await decryptAES(retryKey, raw)
        }
      }

      decrypted =
        value ||
        options.decryptFailureText ||
        ''
    } catch {
      decrypted =
        options.decryptFailureText ||
        ''
    }
  }

  const senderId = String(
    message.senderId ??
    message.SenderId ??
    ''
  )

  const isRead =
    message.isRead ??
    message.IsRead

  const status: UiMessage['status'] =
    senderId === options.myId
      ? isRead
        ? 'read'
        : 'delivered'
      : undefined

  const fileUrl =
    message.fileUrl ||
    message.FileUrl ||
    null

  return {
    id:
      message.messageId ||
      message.id ||
      message.MessageId ||
      undefined,

    senderId,

    plainText:
      decrypted &&
      decrypted !== EMPTY_MSG_MARKER
        ? decrypted
        : '',

    fileUrl: fileUrl
      ? toAbsoluteServerUrl(fileUrl)
      : null,

    status,

    sentAt:
      message.sentAt ||
      message.SentAt ||
      options.fallbackSentAt,

    deliveredAtUtc:
      message.deliveredAtUtc ||
      message.DeliveredAtUtc ||
      null,

    readAtUtc:
      message.readAtUtc ||
      message.ReadAtUtc ||
      null,

    replyToMessageId:
      message.replyToMessageId ||
      message.ReplyToMessageId ||
      null,

    isDeleted: !!(
      message.isDeleted ??
      message.IsDeleted
    ),

    updatedAtUtc:
      message.updatedAtUtc ||
      message.UpdatedAtUtc ||
      null,

    reactions: normalizeReactions(message),

    forwardedFromMessageId:
      message.forwardedFromMessageId ||
      message.ForwardedFromMessageId ||
      null,

    forwardedFromSenderId:
      message.forwardedFromSenderId ||
      message.ForwardedFromSenderId ||
      null
  }
}