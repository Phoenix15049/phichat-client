import type { Ref } from 'vue'
import { getChatKey, storeChatKey } from '../../../services/api'
import { exportAESKey, generateAESKey, importAESKey } from '../../../services/crypto'
import { loadAESKey, saveAESKey } from '../../../utils/aesKeyStore'

/** Which account the locally cached chat keys belong to. */
const ACTIVE_UID_KEY = 'phi.activeUserId'

type UseChatKeysOptions = {
  myId: Ref<string>
}

/**
 * Per-conversation AES keys: local cache first, then the server, and a new key only
 * when the conversation has none yet. Requests are de-duplicated per partner and
 * dropped when the signed-in user changes.
 */
export function useChatKeys({ myId }: UseChatKeysOptions) {
  const chatKeyRequests = new Map<string, Promise<CryptoKey>>()

  let chatKeyGeneration = 0

  function invalidateChatKeyRequests() {
    chatKeyGeneration++
    chatKeyRequests.clear()
  }

  function assertActiveChatKeyRequest(
    ownerId: string,
    generation: number
  ) {
    if (
      generation !== chatKeyGeneration ||
      ownerId !== myId.value
    ) {
      throw new Error('Chat key request is no longer active')
    }
  }

  function loadAESKeyScoped(
    ownerId: string,
    partnerId: string
  ) {
    try {
      const activeUserId = localStorage.getItem(ACTIVE_UID_KEY)
      if (!activeUserId || activeUserId !== ownerId) return null
    } catch {
      return null
    }

    return loadAESKey(partnerId)
  }

  async function saveAESKeyScoped(
    ownerId: string,
    partnerId: string,
    key: CryptoKey
  ) {
    if (ownerId !== myId.value) {
      throw new Error('Authenticated user changed')
    }

    try {
      localStorage.setItem(ACTIVE_UID_KEY, ownerId)
    } catch {}

    await saveAESKey(partnerId, key)
  }

  function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      window.setTimeout(resolve, ms)
    })
  }

  async function loadExistingChatKey(partnerId: string): Promise<CryptoKey | null> {
    const ownerId = myId.value
    if (!ownerId || !partnerId) return null

    const local = await loadAESKeyScoped(ownerId, partnerId)
    if (local) return local

    const pending = chatKeyRequests.get(`${ownerId}:${partnerId}`)
    if (pending) return pending

    const base64Key = await getChatKey(partnerId)
    if (!base64Key || ownerId !== myId.value) return null

    const key = await importAESKey(base64Key)
    await saveAESKeyScoped(ownerId, partnerId, key)
    return key
  }

  async function resolveChatKey(
    ownerId: string,
    partnerId: string,
    generation: number
  ): Promise<CryptoKey> {
    let key = await loadAESKeyScoped(ownerId, partnerId)
    if (key) return key

    assertActiveChatKeyRequest(ownerId, generation)

    let base64Key = await getChatKey(partnerId)
    assertActiveChatKeyRequest(ownerId, generation)

    if (!base64Key) {
      await delay(250)
      assertActiveChatKeyRequest(ownerId, generation)

      base64Key = await getChatKey(partnerId)
      assertActiveChatKeyRequest(ownerId, generation)
    }

    if (base64Key) {
      key = await importAESKey(base64Key)
      assertActiveChatKeyRequest(ownerId, generation)

      await saveAESKeyScoped(ownerId, partnerId, key)
      return key
    }

    const newKey = await generateAESKey()
    const rawKey = await exportAESKey(newKey)

    assertActiveChatKeyRequest(ownerId, generation)

    const exportedKey = btoa(
      String.fromCharCode(...rawKey)
    )

    await storeChatKey({
      receiverId: partnerId,
      encryptedKey: exportedKey
    })

    assertActiveChatKeyRequest(ownerId, generation)

    await saveAESKeyScoped(
      ownerId,
      partnerId,
      newKey
    )

    return newKey
  }

  function getOrLoadKey(
    partnerId: string
  ): Promise<CryptoKey> {
    const ownerId = myId.value

    if (!ownerId || !partnerId) {
      return Promise.reject(
        new Error('Chat key owner or partner is missing')
      )
    }

    const requestId = `${ownerId}:${partnerId}`
    const pending = chatKeyRequests.get(requestId)

    if (pending) return pending

    const generation = chatKeyGeneration

    const request = resolveChatKey(
      ownerId,
      partnerId,
      generation
    ).finally(() => {
      if (chatKeyRequests.get(requestId) === request) {
        chatKeyRequests.delete(requestId)
      }
    })

    chatKeyRequests.set(requestId, request)
    return request
  }

  /** Marks the cached keys as belonging to `userId`. */
  function rememberActiveUser(userId: string) {
    try { localStorage.setItem(ACTIVE_UID_KEY, userId) } catch {}
  }

  return {
    getOrLoadKey,
    loadExistingChatKey,
    invalidateChatKeyRequests,
    rememberActiveUser
  }
}
