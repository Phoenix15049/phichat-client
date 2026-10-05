import { toAbsoluteServerUrl } from '../config/server'
import type { OpenedMessage } from '../stores/e2ee'
import type {
  ServerMessage,
  UiMessage,
  UiReaction
} from '../types/chat'
import { EMPTY_MSG_MARKER } from './messageText'

type MapServerMessageOptions = {
  myId: string
  /** Decrypts a body sent by `senderId` in the current conversation. */
  open: (raw: string, senderId: string) => Promise<OpenedMessage>
  fallbackSentAt?: string
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

/** The encrypted body: `encryptedContent` from the API, `encryptedText` from the hub. */
export function encryptedBodyOf(message: ServerMessage): string {
  return String(
    message.encryptedContent ??
    message.EncryptedContent ??
    message.encryptedText ??
    message.EncryptedText ??
    ''
  )
}

export async function mapServerMessage(
  message: ServerMessage,
  options: MapServerMessageOptions
): Promise<UiMessage> {
  const senderId = String(
    message.senderId ??
    message.SenderId ??
    ''
  )

  const raw = encryptedBodyOf(message)
  const isDeleted = !!(message.isDeleted ?? message.IsDeleted)

  let plainText = ''
  let file: UiMessage['file'] = null
  let cipher: UiMessage['cipher'] = 'ok'

  if (raw.trim() && !isDeleted) {
    const opened = await options.open(raw, senderId)

    if (opened.state === 'ok') {
      const text = opened.envelope.text
      plainText = text && text !== EMPTY_MSG_MARKER ? text : ''
      file = opened.envelope.file ?? null
    } else {
      cipher = opened.state
    }
  }

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

    plainText,
    file,
    cipher,

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

    isDeleted,

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