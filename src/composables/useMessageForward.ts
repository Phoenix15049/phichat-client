import {
  reactive,
  watch,
  type ComputedRef,
  type Ref
} from 'vue'

import { getUserById } from '../services/api'
import { encryptAES } from '../services/crypto'
import { sendMessage } from '../services/signalr'

import type {
  ChatUser,
  UiConversation,
  UiMessage
} from '../types/chat'

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
  forwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
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

  getOrLoadKey:
    (userId: string) => Promise<CryptoKey>

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
}

export function useMessageForward({
  messages,
  conversations,
  selectedUser,
  selectedMessages,
  selectedCount,
  myId,
  getContextMessage,
  closeMenu,
  clearSelection,
  showToast,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend,
  openUserChat
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
          : 'کاربر'
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
        showToast('Username not found')
        return
      }

      await openUserChat({
        id,
        username:
          username.replace(/^@/, '')
      })
    } catch {
      showToast('Username not found')
    }
  }

  async function doForward(
    toPeerId: string
  ) {
    const mode = forwardPicker.mode
    const source = forwardPicker.src
    const sources = forwardPicker.srcList

    forwardPicker.visible = false

    try {
      const aesKey =
        await getOrLoadKey(toPeerId)

      const sameChat =
        selectedUser.value?.id ===
        toPeerId

      if (
        mode === 'single' &&
        source
      ) {
        const encrypted =
          await encryptAES(
            aesKey,
            source.plainText || ''
          )

        const clientId =
          sameChat
            ? crypto.randomUUID()
            : null

        const outgoing = sameChat
          ? await appendOutgoingMessage(
              toPeerId,
              {
                clientId:
                  clientId ?? undefined,

                plainText:
                  source.plainText,

                fileUrl:
                  source.fileUrl || null,

                forwardedFromMessageId:
                  source
                    .forwardedFromMessageId ||
                  source.id ||
                  null,

                forwardedFromSenderId:
                  source
                    .forwardedFromSenderId ||
                  source.senderId ||
                  null
              }
            )
          : {
              senderId: myId.value,

              plainText:
                source.plainText,

              fileUrl:
                source.fileUrl || null,

              sentAt:
                new Date().toISOString()
            }

        await sendMessage(
          toPeerId,
          encrypted,
          source.fileUrl || null,
          clientId,
          null,

          source.forwardedFromMessageId ||
            source.id ||
            null
        )

        updateConversationAfterSend(
          toPeerId,
          outgoing
        )

        return
      }

      if (
        mode !== 'multi' ||
        !sources.length
      ) {
        return
      }

      const list = [...sources].sort(
        (a, b) =>
          (a.sentAt || '').localeCompare(
            b.sentAt || ''
          )
      )

      const clientIds =
        new Map<string, string>()

      let lastOutgoing:
        UiMessage | null = null

      if (sameChat) {
        for (
          const sourceMessage of list
        ) {
          const sourceKey =
            sourceMessage.id ||
            sourceMessage.clientId

          if (!sourceKey) continue

          const clientId =
            crypto.randomUUID()

          clientIds.set(
            sourceKey,
            clientId
          )

          lastOutgoing =
            await appendOutgoingMessage(
              toPeerId,
              {
                clientId,

                plainText:
                  sourceMessage.plainText,

                fileUrl:
                  sourceMessage.fileUrl ||
                  null,

                forwardedFromMessageId:
                  sourceMessage
                    .forwardedFromMessageId ||
                  sourceMessage.id ||
                  null,

                forwardedFromSenderId:
                  sourceMessage
                    .forwardedFromSenderId ||
                  sourceMessage.senderId ||
                  null
              }
            )
        }
      }

      for (
        const sourceMessage of list
      ) {
        const encrypted =
          await encryptAES(
            aesKey,
            sourceMessage.plainText || ''
          )

        const sourceKey =
          sourceMessage.id ||
          sourceMessage.clientId

        const clientId =
          sameChat && sourceKey
            ? clientIds.get(sourceKey) ??
              null
            : null

        await sendMessage(
          toPeerId,
          encrypted,

          sourceMessage.fileUrl ||
            null,

          clientId,
          null,

          sourceMessage
            .forwardedFromMessageId ||
            sourceMessage.id ||
            null
        )
      }

      if (!lastOutgoing) {
        const last =
          list[list.length - 1]

        lastOutgoing = {
          senderId: myId.value,
          plainText: last.plainText,

          fileUrl:
            last.fileUrl || null,

          sentAt:
            new Date().toISOString()
        }
      }

      updateConversationAfterSend(
        toPeerId,
        lastOutgoing
      )

      clearSelection()
      showToast('ارسال شد')
    } catch (error) {
      console.warn(
        'forward failed',
        error
      )
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
    doForward,
    cacheForwardName,
    resolveForwardLabel,
    openForwardUser
  }
}