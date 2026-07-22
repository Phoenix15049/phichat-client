import {
  nextTick,
  ref,
  type Ref
} from 'vue'

import type {
  ChatUser,
  UiMessage
} from '../types/chat'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type UseMessageContextOptions = {
  myId: Ref<string>
  selectedUser: Ref<SelectedUser>
  text: Ref<string>
  msgInput: Ref<HTMLTextAreaElement | null>
  scrollBox: Ref<HTMLElement | null>

  startTyping:
    (receiverId: string) => Promise<void>

  stopTyping:
    (receiverId: string) => Promise<void>
}

export function useMessageContext({
  myId,
  selectedUser,
  text,
  msgInput,
  scrollBox,
  startTyping,
  stopTyping
}: UseMessageContextOptions) {
  const replyingTo =
    ref<UiMessage | null>(null)

  const editingMessage =
    ref<UiMessage | null>(null)

  const previousDraft = ref('')

  const menuEl =
    ref<HTMLElement | null>(null)

  const contextMenu = ref<{
    visible: boolean
    x: number
    y: number
    msg: UiMessage | null
    pillAlign:
      'center' | 'left' | 'right'
  }>({
    visible: false,
    x: 0,
    y: 0,
    msg: null,
    pillAlign: 'center'
  })

  function closeMenu() {
    contextMenu.value.visible = false
    contextMenu.value.msg = null
  }

  function clampMenuPosition() {
    const element = menuEl.value

    if (!element) return

    const padding = 8

    const box =
      scrollBox.value
        ?.getBoundingClientRect()

    const bounds = box
      ? {
          left: box.left + padding,
          top: box.top + padding,
          right: box.right - padding,
          bottom: box.bottom - padding
        }
      : {
          left: padding,
          top: padding,
          right:
            window.innerWidth - padding,
          bottom:
            window.innerHeight - padding
        }

    const rect =
      element.getBoundingClientRect()

    let x = contextMenu.value.x
    let y = contextMenu.value.y

    if (x + rect.width > bounds.right) {
      x = bounds.right - rect.width
    }

    if (x < bounds.left) {
      x = bounds.left
    }

    if (y + rect.height > bounds.bottom) {
      y = bounds.bottom - rect.height
    }

    if (y < bounds.top) {
      y = bounds.top
    }

    contextMenu.value.x = Math.round(x)
    contextMenu.value.y = Math.round(y)

    const pill = element.querySelector(
      '.reaction-pill'
    ) as HTMLElement | null

    const pillWidth =
      pill?.offsetWidth || 228

    const menuCenter =
      contextMenu.value.x +
      rect.width / 2

    let align:
      'center' | 'left' | 'right' =
      'center'

    if (
      menuCenter + pillWidth / 2 >
      bounds.right - padding
    ) {
      align = 'right'
    } else if (
      menuCenter - pillWidth / 2 <
      bounds.left + padding
    ) {
      align = 'left'
    }

    contextMenu.value.pillAlign = align
  }

  function openMenu(
    event: MouseEvent,
    message: UiMessage
  ) {
    if (contextMenu.value.visible) {
      closeMenu()
      return
    }

    contextMenu.value.msg = message
    contextMenu.value.visible = true
    contextMenu.value.x = event.clientX
    contextMenu.value.y = event.clientY

    nextTick(clampMenuPosition)
  }

  function repositionMenu() {
    if (contextMenu.value.visible) {
      nextTick(clampMenuPosition)
    }
  }

  function startReplyFrom(
    message: UiMessage
  ) {
    replyingTo.value = message

    nextTick(() => {
      msgInput.value?.focus()
    })
  }

  function doReply() {
    const message =
      contextMenu.value.msg

    closeMenu()

    if (message) {
      startReplyFrom(message)
    }
  }

  function doEdit() {
    const message =
      contextMenu.value.msg

    closeMenu()

    if (!message) return

    editingMessage.value = message
    previousDraft.value = text.value
    text.value = message.plainText || ''
    replyingTo.value = null

    nextTick(() => {
      const element = msgInput.value

      element?.focus()

      try {
        element?.setSelectionRange(
          element.value.length,
          element.value.length
        )
      } catch {}
    })

    const userId =
      selectedUser.value?.id

    if (userId) {
      startTyping(userId)
        .catch(() => {})
    }
  }

  function cancelEdit() {
    editingMessage.value = null
    text.value = previousDraft.value
    previousDraft.value = ''

    const userId =
      selectedUser.value?.id

    if (
      !text.value.trim() &&
      userId
    ) {
      stopTyping(userId)
        .catch(() => {})
    }
  }

  function completeEdit(
    plainText: string
  ) {
    const message =
      editingMessage.value

    if (!message) return

    message.plainText = plainText

    message.updatedAtUtc =
      new Date().toISOString()

    editingMessage.value = null
    text.value = previousDraft.value
    previousDraft.value = ''
  }

  function isMine(
    message?: UiMessage | null
  ) {
    return (
      !!message &&
      message.senderId === myId.value
    )
  }

  function canEdit(
    message?: UiMessage | null
  ) {
    return (
      isMine(message) &&
      !message?.fileUrl &&
      !message?.isDeleted
    )
  }

  function resetMessageContext() {
    closeMenu()

    replyingTo.value = null
    editingMessage.value = null
    previousDraft.value = ''
  }

  return {
    contextMenu,
    menuEl,
    replyingTo,
    editingMessage,

    openMenu,
    closeMenu,
    repositionMenu,

    startReplyFrom,
    doReply,

    doEdit,
    cancelEdit,
    completeEdit,

    isMine,
    canEdit,
    resetMessageContext
  }
}