import type { Ref } from 'vue'
import type { UiMessage } from '../../../types/chat'

type Attempt = () => Promise<void>

type UseOutboxOptions = {
  messages: Ref<UiMessage[]>
  /** Told about every failed attempt, e.g. to explain why it failed. */
  onError?: (error: unknown) => void
}

/**
 * Tracks outgoing messages until the server accepts them. A failed send keeps its
 * attempt so the user can retry it, instead of the bubble spinning on "sending" forever.
 * Attempts encrypt when they run, so a retry uses the recipient's current key.
 */
export function useOutbox({ messages, onError }: UseOutboxOptions) {
  const attempts = new Map<string, Attempt>()
  /** Messages not yet accepted by the server, per chat: they survive opening another chat. */
  const tracked = new Map<string, { chatId: string; message: UiMessage }>()

  function setStatus(clientId: string, status: UiMessage['status']) {
    // Look the message up in the reactive list so the change re-renders.
    const message = messages.value.find(item => item.clientId === clientId)
    if (message && message.status !== 'delivered' && message.status !== 'read') {
      message.status = status
    }
  }

  async function execute(clientId: string, attempt: Attempt): Promise<boolean> {
    try {
      await attempt()
      attempts.delete(clientId)
      tracked.delete(clientId)
      return true
    } catch (error) {
      console.warn('send failed', error)
      attempts.set(clientId, attempt)
      const entry = tracked.get(clientId)
      if (entry) entry.message.status = 'failed'
      setStatus(clientId, 'failed')
      onError?.(error)
      return false
    }
  }

  /**
   * Runs `attempt` for the outgoing message with `clientId`. Returns false (and marks the
   * message as failed) when it throws. Without a clientId the attempt simply runs.
   */
  function send(clientId: string | null | undefined, attempt: Attempt): Promise<boolean> {
    if (!clientId) {
      return attempt().then(() => true)
    }

    return execute(clientId, attempt)
  }

  async function retry(message: UiMessage): Promise<boolean> {
    const clientId = message.clientId
    const attempt = clientId ? attempts.get(clientId) : undefined
    if (!clientId || !attempt) return false

    setStatus(clientId, 'sending')
    return execute(clientId, attempt)
  }

  /** Drops a failed message from the chat without sending it. */
  function discard(message: UiMessage) {
    if (!message.clientId) return

    attempts.delete(message.clientId)
    tracked.delete(message.clientId)
    const index = messages.value.findIndex(item => item.clientId === message.clientId)
    if (index >= 0) messages.value.splice(index, 1)
  }

  function canRetry(message: UiMessage) {
    return !!message.clientId && attempts.has(message.clientId)
  }

  /** Registers an outgoing message of `chatId` before it is sent. */
  function track(chatId: string, message: UiMessage) {
    if (message.clientId) tracked.set(message.clientId, { chatId, message })
  }

  /** Failed messages of a chat, to show again when it is opened. */
  function failedFor(chatId: string): UiMessage[] {
    return [...tracked.values()]
      .filter(entry => entry.chatId === chatId && entry.message.status === 'failed')
      .map(entry => entry.message)
  }

  /** Whether this device is sending (or failed to send) the message. */
  function owns(clientId: string) {
    return tracked.has(clientId)
  }

  function reset() {
    attempts.clear()
    tracked.clear()
  }

  return { send, retry, discard, canRetry, track, failedFor, owns, reset }
}

export type Outbox = ReturnType<typeof useOutbox>
