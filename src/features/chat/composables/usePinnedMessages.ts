import { computed, ref, type Ref } from 'vue'
import { getPinnedMessages, pinMessage, unpinMessage } from '../../../services/api'
import type { PinsChangedPayload } from '../../../services/signalr'
import type { OpenedMessage } from '../../../stores/e2ee'
import type { ChatUser, UiMessage } from '../../../types/chat'
import { EMPTY_MSG_MARKER } from '../../../utils/messageText'
import { previewText } from './useConversations'
import { t } from '../../../i18n'

export type PinnedItem = { messageId: string; text: string }

type UsePinnedMessagesOptions = {
  selectedUser: Ref<Pick<ChatUser, 'id' | 'username'> | null>
  myId: Ref<string>
  openMessage: (raw: string, senderId: string, peerId: string) => Promise<OpenedMessage>
  jumpTo: (messageId: string) => Promise<void>
  onError: (error: unknown) => void
}

/** Pinned messages of the open chat (shared by both participants; content decrypted here). */
export function usePinnedMessages({ selectedUser, myId, openMessage, jumpTo, onError }: UsePinnedMessagesOptions) {
  const pins = ref<PinnedItem[]>([])
  const index = ref(0)
  let request = 0

  const pinnedIds = computed(() => new Set(pins.value.map(pin => pin.messageId)))
  const current = computed(() => pins.value[index.value] ?? null)

  async function load() {
    const peerId = selectedUser.value?.id
    const mine = ++request
    if (!peerId) {
      pins.value = []
      return
    }

    try {
      const items = await getPinnedMessages(peerId)
      const decoded = await Promise.all(items.map(async item => {
        const opened = await openMessage(item.encryptedContent, item.senderId, peerId)
        let text: string
        if (opened.state === 'ok') {
          const plain = opened.envelope.text
          text = previewText({
            plainText: plain && plain !== EMPTY_MSG_MARKER ? plain : '',
            file: opened.envelope.file ?? null,
            fileUrl: item.fileUrl
          }) || t('common.media')
        } else {
          text = t('e2ee.unreadablePreview')
        }
        return { messageId: item.messageId, text }
      }))

      if (mine !== request || selectedUser.value?.id !== peerId) return
      pins.value = decoded
      if (index.value >= decoded.length) index.value = 0
    } catch (error) {
      console.warn('load pins failed', error)
    }
  }

  function reset() {
    request++
    pins.value = []
    index.value = 0
  }

  const isPinned = (message: UiMessage | null) => !!message?.id && pinnedIds.value.has(message.id)

  async function toggle(message: UiMessage) {
    if (!message.id) return
    try {
      if (isPinned(message)) await unpinMessage(message.id)
      else await pinMessage(message.id)
      await load()
    } catch (error) {
      onError(error)
    }
  }

  /** Banner click: show this pin, then move on to the next older one (like Telegram). */
  async function showCurrent() {
    const pin = current.value
    if (!pin) return
    await jumpTo(pin.messageId)
    if (pins.value.length > 1) index.value = (index.value + 1) % pins.value.length
  }

  async function unpinCurrent() {
    const pin = current.value
    if (!pin) return
    try {
      await unpinMessage(pin.messageId)
      await load()
    } catch (error) {
      onError(error)
    }
  }

  /** A pin was added or removed (by either participant, on any device). */
  function onPinsChanged(payload: PinsChangedPayload) {
    const peerId = selectedUser.value?.id
    if (!peerId) return
    const pair = [String(payload.senderId), String(payload.receiverId)]
    if (pair.includes(peerId) && pair.includes(myId.value)) void load()
  }

  function forget(messageId: string) {
    pins.value = pins.value.filter(pin => pin.messageId !== messageId)
    if (index.value >= pins.value.length) index.value = 0
  }

  return { pins, index, current, pinnedIds, load, reset, isPinned, toggle, showCurrent, unpinCurrent, onPinsChanged, forget }
}
