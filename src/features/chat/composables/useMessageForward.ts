import { t } from '../../../i18n'
import {
  reactive,
  watch,
  type ComputedRef,
  type Ref
} from 'vue'

import { getUserById } from '../../../services/api'
import type { AlbumMeta, FileMeta } from '../../../services/e2ee/messageCodec'
import { sendMessage } from '../../../services/signalr'

import type {
  ChatUser,
  UiConversation,
  UiMessage
} from '../../../types/chat'
import type { Outbox } from './useOutbox'
import type { SealAndSend } from '../attachments'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type ChatReference = {
  id: string
  username: string
}

type ForwardOutgoingInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  file?: FileMeta | null
  forwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
  album?: AlbumMeta | null
}

type UseMessageForwardOptions = {
  messages: Ref<UiMessage[]>
  conversations: Ref<UiConversation[]>
  selectedUser: Ref<SelectedUser>
  selectedMessages: ComputedRef<UiMessage[]>
  selectedCount: ComputedRef<number>
  myId: Ref<string>

  getContextMessage:
    () => UiMessage | null

  closeMenu: () => void
  clearSelection: () => void
  showToast: (text: string) => void

  sealAndSend: SealAndSend

  onForwardError: (error: unknown) => void

  appendOutgoingMessage: (
    peerId: string,
    input: ForwardOutgoingInput
  ) => Promise<UiMessage>

  updateConversationAfterSend: (
    peerId: string,
    message: Pick<
      UiMessage,
      'plainText' | 'fileUrl' | 'sentAt'
    >
  ) => void

  openUserChat:
    (user: ChatReference) => Promise<void>

  outbox: Outbox
}

export function useMessageForward({
  messages,
  conversations,
  selectedUser,
  selectedMessages,
  selectedCount,
  getContextMessage,
  closeMenu,
  clearSelection,
  showToast,
  sealAndSend,
  onForwardError,
  appendOutgoingMessage,
  updateConversationAfterSend,
  openUserChat,
  outbox
}: UseMessageForwardOptions) {
  const forwardNames =
    reactive<Record<string, string>>({})

  const forwardHandles =
    reactive<Record<string, string>>({})

  const forwardPicker = reactive<{
    visible: boolean
    mode: 'single' | 'multi'
    src: UiMessage | null
    srcList: UiMessage[]
  }>({
    visible: false,
    mode: 'single',
    src: null,
    srcList: []
  })

  function openForwardPickerMulti() {
    if (!selectedCount.value) return

    forwardPicker.visible = true
    forwardPicker.mode = 'multi'
    forwardPicker.src = null

    forwardPicker.srcList = [
      ...selectedMessages.value
    ]
  }

  /** Forwards exactly these messages (an album, or a song from the player). */
  function openForwardPickerFor(list: UiMessage[]) {
    closeMenu()
    forwardPicker.mode = 'multi'
    forwardPicker.src = null
    forwardPicker.srcList = [...list]
    forwardPicker.visible = true
  }

  function openForwardPicker() {
    const message = getContextMessage()

    if (!message) return

    forwardPicker.visible = true
    forwardPicker.mode = 'single'
    forwardPicker.src = message
    forwardPicker.srcList = []

    closeMenu()
  }

  async function cacheForwardName(
    userId: string
  ) {
    if (
      forwardNames[userId] &&
      forwardHandles[userId]
    ) {
      return
    }

    const conversation =
      conversations.value.find(
        item => item.peerId === userId
      )

    if (conversation) {
      const handle =
        (conversation.username || '')
          .replace(/^@/, '')

      const label =
        conversation.displayName ||
        (handle ? `@${handle}` : '')

      if (label) {
        forwardNames[userId] = label
      }

      if (handle) {
        forwardHandles[userId] = handle
      }
    }

    try {
      const user =
        await getUserById(userId)

      const handleRaw =
        user.username ??
        user.Username ??
        ''

      const handle =
        handleRaw.replace(/^@/, '')

      const displayName =
        user.displayName?.trim() ||
        user.DisplayName?.trim() ||
        [
            user.firstName ??
            user.FirstName,

            user.lastName ??
            user.LastName
        ]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        user.name?.trim() ||
        user.Name?.trim() ||
        ''

      const label =
        displayName.trim() ||
        (handle ? `@${handle}` : '')

      if (label) {
        forwardNames[userId] = label
      }

      if (handle) {
        forwardHandles[userId] = handle
      }
    } catch {}
  }

  function resolveForwardLabel(
    userId: string
  ) {
    return (
      forwardNames[userId] ||
      (
        forwardHandles[userId]
          ? `@${forwardHandles[userId]}`
          : t('common.user')
      )
    )
  }

  async function openForwardUser(
    userId: string
  ) {
    try {
      const user =
        await getUserById(userId)

      const id =
        user.id ??
        user.Id

      const username =
        user.username ??
        user.Username

      if (!id || !username) {
        showToast(t('chat.usernameNotFound'))
        return
      }

      await openUserChat({
        id,
        username:
          username.replace(/^@/, '')
      })
    } catch {
      showToast(t('chat.usernameNotFound'))
    }
  }

  /**
   * Readable messages can be forwarded (the text and the attachment key are re-encrypted
   * for the new chat; the server copies the stored ciphertext). An unreadable one cannot,
   * except an old unencrypted attachment, which is forwarded as it is.
   */
  function canForward(message: UiMessage) {
    if (!message.cipher || message.cipher === 'ok') return true
    return message.cipher === 'legacy' && !!message.fileUrl
  }

  function forwardOf(source: UiMessage): ForwardOutgoingInput {
    return {
      plainText: source.plainText,
      fileUrl: source.fileUrl || null,
      file: source.file ?? null,
      forwardedFromMessageId:
        source.forwardedFromMessageId ||
        source.id ||
        null,
      forwardedFromSenderId:
        source.forwardedFromSenderId ||
        source.senderId ||
        null
    }
  }

  function sendForward(
    toPeerId: string,
    source: UiMessage,
    clientId: string | null,
    album: AlbumMeta | null
  ) {
    const input = forwardOf(source)

    return outbox.send(clientId, () =>
      sealAndSend(
        toPeerId,
        {
          text: source.plainText || '',
          ...(source.file ? { file: source.file } : {}),
          ...(album ? { album } : {})
        },
        body => sendMessage(
          toPeerId,
          body,
          null,
          clientId,
          null,
          input.forwardedFromMessageId
        )
      )
    )
  }

  async function doForward(
    toPeerId: string
  ) {
    const mode = forwardPicker.mode

    const sources = (
      mode === 'single'
        ? (forwardPicker.src ? [forwardPicker.src] : [])
        : [...forwardPicker.srcList]
    )
      .filter(canForward)
      .sort(
        (a, b) =>
          (a.sentAt || '').localeCompare(
            b.sentAt || ''
          )
      )

    forwardPicker.visible = false

    if (!sources.length) {
      showToast(t('e2ee.cannotForward'))
      return
    }

    const sameChat =
      selectedUser.value?.id ===
      toPeerId

    let lastOutgoing:
      Pick<UiMessage, 'plainText' | 'fileUrl' | 'sentAt'> | null = null

    // Items of one album stay together in the new chat, under a new album id.
    const albumSizes = new Map<string, number>()
    for (const source of sources) {
      if (source.album) albumSizes.set(source.album.id, (albumSizes.get(source.album.id) ?? 0) + 1)
    }
    const newAlbums = new Map<string, { id: string; next: number }>()

    function albumFor(source: UiMessage): AlbumMeta | null {
      const count = source.album ? albumSizes.get(source.album.id) ?? 0 : 0
      if (!source.album || count < 2) return null

      let entry = newAlbums.get(source.album.id)
      if (!entry) {
        entry = { id: crypto.randomUUID(), next: 0 }
        newAlbums.set(source.album.id, entry)
      }
      return { id: entry.id, index: entry.next++, count }
    }

    try {
      for (const source of sources) {
        const album = albumFor(source)

        // In the open chat the forward appears at once (with a retry button if it fails).
        const clientId =
          sameChat
            ? crypto.randomUUID()
            : null

        if (clientId) {
          lastOutgoing =
            await appendOutgoingMessage(
              toPeerId,
              {
                clientId,
                ...forwardOf(source),
                album
              }
            )
        } else {
          lastOutgoing = {
            plainText: source.plainText,
            fileUrl: source.fileUrl || null,
            sentAt: new Date().toISOString()
          }
        }

        await sendForward(
          toPeerId,
          source,
          clientId,
          album
        )
      }

      if (lastOutgoing) {
        updateConversationAfterSend(
          toPeerId,
          lastOutgoing
        )
      }

      if (mode === 'multi') {
        clearSelection()
        showToast(t('chat.sent'))
      }
    } catch (error) {
      console.warn(
        'forward failed',
        error
      )
      onForwardError(error)
    }
  }

  watch(
    () =>
      messages.value
        .map(
          message =>
            message.forwardedFromSenderId
        )
        .filter(
          (id): id is string => !!id
        ),

    ids => {
      for (const id of new Set(ids)) {
        if (!forwardNames[id]) {
          cacheForwardName(id)
        }
      }
    },

    {
      immediate: true
    }
  )

  return {
    forwardPicker,
    openForwardPicker,
    openForwardPickerMulti,
    openForwardPickerFor,
    doForward,
    cacheForwardName,
    resolveForwardLabel,
    openForwardUser
  }
}