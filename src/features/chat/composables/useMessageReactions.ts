import {
  computed,
  ref,
  type Ref
} from 'vue'
import { usePreferencesStore } from '../../../stores/preferences'

import {
  addReaction,
  removeReaction,
  type ReactionSnapshot
} from '../../../services/api'

import type {
  UiMessage
} from '../../../types/chat'

export type ReactionUpdatePayload = ReactionSnapshot & { messageId: string }

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
  // Chosen in Settings > Reactions.
  const { prefs } = usePreferencesStore()
  const quickEmojis = computed(() => prefs.quickReactions)

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

  /** Newest server snapshot applied per message; older ones arriving late are ignored. */
  const snapshotVersions = new Map<string, number>()

  /** Reaction changes of one message go to the server one after another (the last click wins). */
  const pending = new Map<string, Promise<unknown>>()

  /**
   * Latest local change per message. While newer clicks are still queued, the answers to older
   * ones (and other people's updates) would undo what the user sees; the last answer includes
   * all of them anyway, so only it is applied.
   */
  const latestChange = new Map<string, number>()
  let changeSeq = 0

  function applySnapshot(message: UiMessage, snapshot: ReactionSnapshot) {
    if (!message.id) return
    if (snapshot.version < (snapshotVersions.get(message.id) ?? 0)) return

    snapshotVersions.set(message.id, snapshot.version)
    message.reactions = snapshot.reactions.map(reaction => ({
      emoji: reaction.emoji,
      count: reaction.count,
      mine: reaction.userIds.includes(myId.value)
    }))
  }

  /**
   * One reaction per person (like Telegram): the chosen emoji replaces mine, choosing it again
   * removes it. Shown at once, then replaced by the server's list for the message.
   */
  async function toggleReaction(
    message: UiMessage,
    emoji: string
  ) {
    const messageId = message.id
    if (!messageId) return

    const before = message.reactions ?? []

    // An emoji already on the message (perhaps in another variation form) is reused as-is,
    // so the server counts both under the same key.
    const existing = before.find(reaction => normalizeEmoji(reaction.emoji) === normalizeEmoji(emoji))
    const target = existing?.emoji ?? emoji
    const removing = !!existing?.mine

    const next = before
      .map(reaction => ({ ...reaction }))
      .map(reaction => (reaction.mine ? { ...reaction, mine: false, count: reaction.count - 1 } : reaction))

    if (!removing) {
      const same = next.find(reaction => reaction.emoji === target)
      if (same) {
        same.count += 1
        same.mine = true
      } else {
        next.push({ emoji: target, count: 1, mine: true })
      }
    }

    message.reactions = next.filter(reaction => reaction.count > 0)

    const seq = ++changeSeq
    latestChange.set(messageId, seq)

    const previousRequest = pending.get(messageId) ?? Promise.resolve()
    const request = previousRequest
      .catch(() => {})
      .then(async () => {
        const snapshot = removing
          ? await removeReaction(messageId, target)
          : await addReaction(messageId, target)
        if (latestChange.get(messageId) === seq) applySnapshot(message, snapshot)
      })
      .catch(() => {
        // Nothing newer from the server: put back what was there.
        if (!snapshotVersions.has(messageId)) message.reactions = before
      })

    pending.set(messageId, request)
    await request
    if (pending.get(messageId) === request) pending.delete(messageId)
    if (latestChange.get(messageId) === seq) latestChange.delete(messageId)
  }

  async function applyReaction(
    message: UiMessage,
    emoji: string
  ) {
    // The menu closes at once; the reaction is already shown and goes to the server meanwhile.
    suppressHoverUntil =
      Date.now() + 700

    clearHoverTimer()

    reactionPickerFor.value = null
    hoverReactFor.value = null

    closeMenu()

    await toggleReaction(
      message,
      emoji
    )
  }

  /** Someone (perhaps me on another device) changed a reaction: take the server's full list. */
  function handleReactionUpdated(
    payload: ReactionUpdatePayload
  ) {
    const message =
      messages.value.find(
        item =>
          item.id === payload.messageId
      )

    if (!message || !Array.isArray(payload.reactions)) return

    // My own clicks on this message are still on their way; their answer will be complete.
    if (latestChange.has(payload.messageId)) return

    applySnapshot(message, payload)
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