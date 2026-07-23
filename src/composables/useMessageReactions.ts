import {
  ref,
  type Ref
} from 'vue'

import {
  addReaction,
  removeReaction
} from '../services/api'

import {
  dedupeReactions
} from '../utils/messageMapper'

import type {
  UiMessage
} from '../types/chat'

export type ReactionUpdatePayload = {
  messageId: string
  emoji: string
  count: number
  userId: string
  action: 'added' | 'removed'
}

type UseMessageReactionsOptions = {
  messages: Ref<UiMessage[]>
  myId: Ref<string>
  getMsgKey: (message: UiMessage) => string
  closeMenu: () => void
}

export function useMessageReactions({
  messages,
  myId,
  getMsgKey,
  closeMenu
}: UseMessageReactionsOptions) {
  const quickEmojis = [
    '👍',
    '❤️',
    '😂',
    '😮',
    '😢',
    '🔥',
    '🙏',
    '🎹'
  ]

  const reactionPickerFor =
    ref<string | null>(null)

  const hoverReactFor =
    ref<string | null>(null)

  let hoverReactTimer:
    number | null = null

  let hoverBarHideTimer:
    number | null = null

  let suppressHoverUntil = 0

  const HOVER_REACT_DELAY = 1000

  function normalizeEmoji(
    emoji: string
  ): string {
    return (emoji || '')
      .replace(/\uFE0F/g, '')
      .replace(
        /[\u{1F3FB}-\u{1F3FF}]/gu,
        ''
      )
  }

  function clearHoverTimer() {
    if (!hoverReactTimer) return

    window.clearTimeout(
      hoverReactTimer
    )

    hoverReactTimer = null
  }

  function clearHideTimer() {
    if (!hoverBarHideTimer) return

    window.clearTimeout(
      hoverBarHideTimer
    )

    hoverBarHideTimer = null
  }

  function keepHoverBar() {
    clearHideTimer()
  }

  function hideHoverBarSoon() {
    clearHideTimer()

    hoverBarHideTimer =
      window.setTimeout(() => {
        hoverReactFor.value = null
        hoverBarHideTimer = null
      }, 300)
  }

  function onBubbleHoverStart(
    message: UiMessage
  ) {
    if (
      Date.now() <
      suppressHoverUntil
    ) {
      return
    }

    clearHoverTimer()
    keepHoverBar()

    hoverReactTimer =
      window.setTimeout(() => {
        hoverReactFor.value =
          getMsgKey(message)

        hoverReactTimer = null
      }, HOVER_REACT_DELAY)
  }

  function onBubbleHoverEnd() {
    clearHoverTimer()
    hideHoverBarSoon()
  }

  async function toggleReaction(
    message: UiMessage,
    emoji: string
  ) {
    if (!message.id) return

    const list =
      message.reactions ||
      (message.reactions = [])

    message.reactions =
      dedupeReactions(list)

    const emojiKey =
      normalizeEmoji(emoji)

    const previousMine =
      message.reactions.find(
        reaction =>
          reaction.mine &&
          normalizeEmoji(
            reaction.emoji
          ) !== emojiKey
      )

    if (previousMine) {
      previousMine.mine = false

      previousMine.count =
        Math.max(
          0,
          previousMine.count - 1
        )

      if (
        previousMine.count === 0
      ) {
        message.reactions =
          message.reactions.filter(
            reaction =>
              reaction !== previousMine
          )
      }

      removeReaction(
        message.id,
        previousMine.emoji
      ).catch(() => {})
    }

    const current =
      message.reactions.find(
        reaction =>
          normalizeEmoji(
            reaction.emoji
          ) === emojiKey
      )

    if (current?.mine) {
      current.mine = false

      current.count =
        Math.max(
          0,
          current.count - 1
        )

      if (current.count === 0) {
        message.reactions =
          message.reactions.filter(
            reaction =>
              reaction !== current
          )
      }

      try {
        await removeReaction(
          message.id,
          emoji
        )
      } catch {}
    } else {
      if (current) {
        current.mine = true
        current.count += 1
      } else {
        message.reactions.push({
          emoji,
          count: 1,
          mine: true
        })
      }

      message.reactions =
        dedupeReactions(
          message.reactions
        )

      try {
        await addReaction(
          message.id,
          emoji
        )
      } catch {}
    }
  }

  async function applyReaction(
    message: UiMessage,
    emoji: string
  ) {
    await toggleReaction(
      message,
      emoji
    )

    suppressHoverUntil =
      Date.now() + 700

    clearHoverTimer()

    reactionPickerFor.value = null
    hoverReactFor.value = null

    closeMenu()
  }

  function handleReactionUpdated(
    payload: ReactionUpdatePayload
  ) {
    const message =
      messages.value.find(
        item =>
          item.id === payload.messageId
      )

    if (!message) return

    const list =
      message.reactions ||
      (message.reactions = [])

    const emojiKey =
      normalizeEmoji(
        payload.emoji
      )

    const indexes = list
      .map((reaction, index) =>
        normalizeEmoji(
          reaction.emoji
        ) === emojiKey
          ? index
          : -1
      )
      .filter(index => index >= 0)

    if (indexes.length === 0) {
      list.push({
        emoji: payload.emoji,
        count: payload.count,

        mine:
          payload.userId ===
            myId.value &&
          payload.action === 'added'
      })
    } else {
      const first =
        list[indexes[0]]

      first.emoji = payload.emoji
      first.count = payload.count

      if (
        payload.userId === myId.value
      ) {
        first.mine =
          payload.action === 'added'
      }

      for (
        let index =
          indexes.length - 1;
        index >= 1;
        index--
      ) {
        list.splice(
          indexes[index],
          1
        )
      }
    }

    if (
      payload.userId === myId.value &&
      payload.action === 'added'
    ) {
      for (const reaction of list) {
        if (
          normalizeEmoji(
            reaction.emoji
          ) !== emojiKey
        ) {
          reaction.mine = false
        }
      }
    }

    message.reactions =
      dedupeReactions(list)
  }

  function resetReactionUi() {
    clearHoverTimer()
    clearHideTimer()

    reactionPickerFor.value = null
    hoverReactFor.value = null
    suppressHoverUntil = 0
  }

  return {
    quickEmojis,
    reactionPickerFor,
    hoverReactFor,

    applyReaction,
    keepHoverBar,
    hideHoverBarSoon,
    onBubbleHoverStart,
    onBubbleHoverEnd,

    handleReactionUpdated,
    resetReactionUi,
    disposeReactions:
      resetReactionUi
  }
}