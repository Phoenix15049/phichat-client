import { t } from '../../../i18n'
import type { Ref } from 'vue'
import { toAbsoluteServerUrl } from '../../../config/server'
import type { getConversations } from '../../../services/api'
import type { OpenedMessage } from '../../../stores/e2ee'
import type { ChatUser, ServerMessage, UiConversation, UiMessage } from '../../../types/chat'
import { EMPTY_MSG_MARKER } from '../../../utils/messageText'
import { normalizeUsername } from '../../../utils/username'
import { toDateSafe } from '../../../utils/time'
import type { usePeerDirectory } from './usePeerDirectory'

export type IncomingMessage = ServerMessage & {
  senderUsername?: string
  SenderUsername?: string
}

type ConversationSummary = Awaited<ReturnType<typeof getConversations>>[number]

/** Shown for an incoming message until its text is decrypted. */
const newMessagePlaceholder = () => t('chat.newMessage')

type UseConversationsOptions = {
  conversations: Ref<UiConversation[]>
  selectedUser: Ref<Pick<ChatUser, 'id' | 'username'> | null>
  peers: Pick<ReturnType<typeof usePeerDirectory>, 'displayById' | 'avatarById' | 'ensurePeerCached'>
  /** Decrypts a message of the conversation with `peerId` sent by `senderId`. */
  openMessage: (raw: string, senderId: string, peerId: string) => Promise<OpenedMessage>
}

function toAbsoluteUrlOrNull(url: string | null): string | null {
  return url ? toAbsoluteServerUrl(url) : null
}

/** The conversation list: ordering, previews and updates on send / receive. */
export function useConversations({
  conversations,
  selectedUser,
  peers,
  openMessage
}: UseConversationsOptions) {
  const { displayById, avatarById, ensurePeerCached } = peers

  /** Replaces the list with the server's conversations, newest first, and decrypts previews. */
  function setConversations(data: ConversationSummary[]) {
    conversations.value = data.map(c => ({
      peerId: c.peerId,
      username: c.peerUsername || '',
      displayName: c.peerDisplayName || null,
      avatarUrl: c.peerAvatarUrl || null,
      unreadCount: c.unreadCount ?? 0,
      lastSentAt: c.lastSentAt || null,
      lastFileUrl: c.lastFileUrl || null,
      lastPreview: null
    }))

    for (const c of conversations.value) {
      if (c.displayName) displayById[c.peerId] = c.displayName
      if (c.avatarUrl) avatarById[c.peerId] = c.avatarUrl
    }

    conversations.value.sort((a, b) => {
      const ta = toDateSafe(a.lastSentAt)?.getTime() || 0
      const tb = toDateSafe(b.lastSentAt)?.getTime() || 0
      return tb - ta
    })

    for (const c of data) {
      if (c.lastEncryptedContent && !c.lastFileUrl) {
        void refreshConversationPreview(c.peerId, c.lastEncryptedContent, c.lastSenderId || c.peerId)
      }
    }
  }

  function moveConversationToTop(index: number) {
    if (index <= 0) return

    const [conversation] = conversations.value.splice(index, 1)
    if (conversation) conversations.value.unshift(conversation)
  }

  function updateConversationAfterSend(
    peerId: string,
    message: Pick<
      UiMessage,
      'plainText' | 'fileUrl' | 'sentAt'
    >,
    username?: string
  ) {
    const index = conversations.value.findIndex(
      conversation =>
        conversation.peerId === peerId
    )

    const sentAt =
      message.sentAt ??
      new Date().toISOString()

    if (index < 0) {
      if (!username) return

      conversations.value.unshift({
        peerId,
        username,
        displayName:
          displayById[peerId] ?? null,

        avatarUrl:
          avatarById[peerId] ?? null,

        unreadCount: 0,
        lastSentAt: sentAt,
        lastFileUrl: message.fileUrl,

        lastPreview:
          message.plainText ||
          (message.fileUrl ? null : '')
      })

      return
    }

    const conversation =
      conversations.value[index]

    conversation.lastSentAt = sentAt
    conversation.lastFileUrl = message.fileUrl

    conversation.lastPreview =
      message.plainText ||
      (message.fileUrl ? null : '')

    moveConversationToTop(index)
  }

  function incomingSentAt(message: ServerMessage) {
    return message.sentAt ?? message.SentAt ?? new Date().toISOString()
  }

  function incomingFileUrl(message: ServerMessage) {
    return toAbsoluteUrlOrNull(message.fileUrl ?? message.FileUrl ?? null)
  }

  function incomingUsername(message: IncomingMessage) {
    return normalizeUsername(message.senderUsername ?? message.SenderUsername ?? '')
  }

  function upsertIncomingConversation(
    peerId: string,
    message: IncomingMessage,
    incrementUnread: boolean
  ) {
    const sentAt = incomingSentAt(message)
    const fileUrl = incomingFileUrl(message)
    const index = conversations.value.findIndex(item => item.peerId === peerId)

    if (index >= 0) {
      const conversation = conversations.value[index]

      conversation.lastSentAt = sentAt
      conversation.lastFileUrl = fileUrl
      conversation.lastPreview = fileUrl ? null : newMessagePlaceholder()
      conversation.unreadCount = incrementUnread
        ? conversation.unreadCount + 1
        : 0

      moveConversationToTop(index)
      return
    }

    const username =
      incomingUsername(message) ||
      (selectedUser.value?.id === peerId ? selectedUser.value.username : '') ||
      peerId

    conversations.value.unshift({
      peerId,
      username,
      displayName: displayById[peerId] ?? null,
      avatarUrl: avatarById[peerId] ?? null,
      unreadCount: incrementUnread ? 1 : 0,
      lastSentAt: sentAt,
      lastFileUrl: fileUrl,
      lastPreview: fileUrl ? null : newMessagePlaceholder()
    })

    void ensurePeerCached(peerId)
  }

  function updateIncomingPreview(peerId: string, message: UiMessage) {
    const index = conversations.value.findIndex(item => item.peerId === peerId)
    if (index < 0) return

    const conversation = conversations.value[index]

    conversation.lastSentAt = message.sentAt ?? conversation.lastSentAt
    conversation.lastFileUrl = message.fileUrl
    conversation.lastPreview =
      message.plainText || (message.fileUrl ? null : '')

    moveConversationToTop(index)
  }

  /** Latest preview request per conversation; older decryptions finishing late are ignored. */
  const previewRequests = new Map<string, string>()

  async function refreshConversationPreview(peerId: string, cipher: string, senderId: string) {
    previewRequests.set(peerId, cipher)

    try {
      const opened = await openMessage(cipher, senderId, peerId)
      if (previewRequests.get(peerId) !== cipher) return

      let plain: string
      if (opened.state === 'ok') {
        plain = opened.envelope.text
        if (!plain || plain === EMPTY_MSG_MARKER) return
      } else {
        plain = t('e2ee.unreadablePreview')
      }

      const conversation = conversations.value.find(item => item.peerId === peerId)
      // Only fill in if nothing newer replaced the preview meanwhile.
      if (conversation && !conversation.lastFileUrl && (conversation.lastPreview == null || conversation.lastPreview === newMessagePlaceholder())) {
        conversation.lastPreview = plain
      }
    } catch {}
  }

  return {
    setConversations,
    moveConversationToTop,
    updateConversationAfterSend,
    upsertIncomingConversation,
    updateIncomingPreview,
    refreshConversationPreview,
    incomingFileUrl
  }
}
