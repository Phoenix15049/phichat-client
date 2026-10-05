import {
  computed,
  nextTick,
  type Ref
} from 'vue'

import {
  editMessage
} from '../../../services/api'

import {
  sendMessage,
  startTyping,
  stopTyping
} from '../../../services/signalr'

import type {
  ChatUser,
  UiMessage
} from '../../../types/chat'
import type { Outbox } from './useOutbox'
import type { MessageEnvelope } from '../../../services/e2ee/messageCodec'
import { E2eeError } from '../../../services/e2ee/primitives'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type ComposerOutgoingInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  sentAt?: string
  replyToMessageId?: string | null
}

type UseChatComposerOptions = {
  myId: Ref<string>
  selectedUser: Ref<SelectedUser>
  text: Ref<string>

  msgInput:
    Ref<HTMLTextAreaElement | null>

  editingMessage:
    Ref<UiMessage | null>

  replyingTo:
    Ref<UiMessage | null>

  /** Encrypts for the peer's current key and hands the body to `send`. */
  sealAndSend: (
    peerId: string,
    envelope: MessageEnvelope,
    send: (body: string) => Promise<unknown>
  ) => Promise<void>

  /** Peers that cannot receive encrypted messages yet. */
  peerMissingKey: Record<string, boolean>

  /** Explains a send or edit that could not be done. */
  onSendError: (error: unknown) => void

  appendOutgoingMessage: (
    peerId: string,
    input: ComposerOutgoingInput
  ) => Promise<UiMessage>

  updateConversationAfterSend: (
    peerId: string,
    message: Pick<
      UiMessage,
      'plainText' | 'fileUrl' | 'sentAt'
    >,
    username?: string
  ) => void

  completeEdit:
    (plainText: string) => void

  outbox: Outbox
}

export function useChatComposer({
  myId,
  selectedUser,
  text,
  msgInput,
  editingMessage,
  replyingTo,
  sealAndSend,
  peerMissingKey,
  onSendError,
  appendOutgoingMessage,
  updateConversationAfterSend,
  completeEdit,
  outbox
}: UseChatComposerOptions) {
  const MIN_ROWS = 1
  const MAX_ROWS = 6

  let lastTypingSentAt = 0

  const canSend = computed(
    () =>
      !!selectedUser.value &&
      !peerMissingKey[selectedUser.value.id] &&
      !!text.value.trim()
  )

  function draftKey(
    peerId: string
  ) {
    const userId =
      myId.value || 'me'

    return `phi.draft.${userId}.${peerId}`
  }

  function loadDraft(
    peerId: string
  ): string {
    try {
      return (
        localStorage.getItem(
          draftKey(peerId)
        ) || ''
      )
    } catch {
      return ''
    }
  }

  function saveDraft(
    peerId: string,
    value: string
  ) {
    try {
      localStorage.setItem(
        draftKey(peerId),
        value
      )
    } catch {}
  }

  function clearDraft(
    peerId: string
  ) {
    try {
      localStorage.removeItem(
        draftKey(peerId)
      )
    } catch {}
  }

  function autoGrow(
    element?: HTMLTextAreaElement | null,
    options?: {
      animate?: boolean
    }
  ) {
    const textarea =
      element ?? msgInput.value

    if (!textarea) return

    const style =
      window.getComputedStyle(textarea)

    const lineHeight =
      Number.parseFloat(
        style.lineHeight
      ) || 24

    const padding =
      Number.parseFloat(
        style.paddingTop
      ) +
      Number.parseFloat(
        style.paddingBottom
      )

    const border =
      Number.parseFloat(
        style.borderTopWidth
      ) +
      Number.parseFloat(
        style.borderBottomWidth
      )

    const minHeight =
      lineHeight * MIN_ROWS +
      padding +
      border

    const maxHeight =
      lineHeight * MAX_ROWS +
      padding +
      border

    const previousHeight =
      textarea.offsetHeight ||
      minHeight

    const previousOverflow =
      textarea.style.overflowY

    textarea.style.overflowY =
      'hidden'

    textarea.style.height =
      'auto'

    const contentHeight =
      textarea.scrollHeight +
      border

    const targetHeight =
      Math.max(
        minHeight,
        Math.min(
          contentHeight,
          maxHeight
        )
      )

    const difference =
      Math.abs(
        targetHeight -
        previousHeight
      )

    const animate =
      (options?.animate ?? true) &&
      difference >= 1

    textarea.style.overflowY =
      contentHeight > maxHeight
        ? 'auto'
        : previousOverflow ||
          'hidden'

    if (!animate) {
      const previousTransition =
        textarea.style.transition

      textarea.style.transition =
        'none'

      textarea.style.height =
        `${Math.round(
          targetHeight
        )}px`

      void textarea.offsetHeight

      textarea.style.transition =
        previousTransition

      return
    }

    textarea.style.height =
      `${previousHeight}px`

    void textarea.offsetHeight

    textarea.style.height =
      `${Math.round(
        targetHeight
      )}px`
  }

  function onInputChanged() {
    const user =
      selectedUser.value

    if (!user) return

    const now = Date.now()

    if (
      now - lastTypingSentAt >
      900
    ) {
      startTyping(user.id)
        .catch(() => {})

      lastTypingSentAt = now
    }

    if (!text.value.trim()) {
      stopTyping(user.id)
        .catch(() => {})
    }

    // While editing, the composer holds the message being edited, not a draft.
    if (editingMessage.value) return

    saveDraft(
      user.id,
      text.value
    )
  }

  function onComposerInput(
    event: Event
  ) {
    onInputChanged()

    autoGrow(
      event.target as
        HTMLTextAreaElement,
      {
        animate: true
      }
    )
  }

  function onBlurInput() {
    const userId =
      selectedUser.value?.id

    if (!userId) return

    stopTyping(userId)
      .catch(() => {})
  }

  async function finishComposerSend(
    peerId: string
  ) {
    clearDraft(peerId)

    stopTyping(peerId)
      .catch(() => {})

    if (
      selectedUser.value?.id !==
      peerId
    ) {
      return
    }

    replyingTo.value = null
    text.value = ''

    await nextTick()

    autoGrow(undefined, {
      animate: true
    })
  }

  async function send() {
    const user =
      selectedUser.value

    const draft =
      text.value

    if (
      !user ||
      !draft.trim()
    ) {
      return
    }

    if (peerMissingKey[user.id]) {
      onSendError(new E2eeError('recipient_no_key'))
      return
    }

    if (
      editingMessage.value &&
      editingMessage.value.id
    ) {
      const messageId =
        editingMessage.value.id

      try {
        await sealAndSend(
          user.id,
          { text: draft.trim() },
          body => editMessage(messageId, body)
        )

        completeEdit(
          draft.trim()
        )
      } catch (error) {
        console.warn(
          'edit failed',
          error
        )
        onSendError(error)
      }

      return
    }

    const replyId =
      replyingTo.value?.id ??
      null

    const outgoing =
      await appendOutgoingMessage(
        user.id,
        {
          plainText: draft,
          fileUrl: null,
          replyToMessageId:
            replyId
        }
      )

    updateConversationAfterSend(
      user.id,
      outgoing,
      user.username
    )

    // Encrypted when the attempt runs; a failed send stays in the chat with a retry button.
    await outbox.send(outgoing.clientId, () =>
      sealAndSend(
        user.id,
        { text: draft },
        body => sendMessage(
          user.id,
          body,
          null,
          outgoing.clientId ?? null,
          replyId
        )
      )
    )

    await finishComposerSend(
      user.id
    )
  }

  return {
    canSend,
    loadDraft,
    autoGrow,
    onComposerInput,
    onBlurInput,
    send
  }
}