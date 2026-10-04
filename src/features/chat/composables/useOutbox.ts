import type { Ref } from 'vue'
import type { UiMessage } from '../../../types/chat'

type Attempt = () => Promise<void>

type UseOutboxOptions = {
  messages: Ref<UiMessage[]>
}

/**
 * Tracks outgoing messages until the server accepts them. A failed send keeps its
 * attempt (already-encrypted payload or file) so the user can retry it exactly, instead
 * of the bubble spinning on "sending" forever.
 */
export function useOutbox({ messages }: UseOutboxOptions) {
  const attempts = new Map<string, Attempt>()

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
      return true
    } catch (error) {
      console.warn('send failed', error)
      attempts.set(clientId, attempt)
      setStatus(clientId, 'failed')
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
    const index = messages.value.findIndex(item => item.clientId === message.clientId)
    if (index >= 0) messages.value.splice(index, 1)
  }

  function canRetry(message: UiMessage) {
    return !!message.clientId && attempts.has(message.clientId)
  }

  function reset() {
    attempts.clear()
  }

  return { send, retry, discard, canRetry, reset }
}

export type Outbox = ReturnType<typeof useOutbox>
