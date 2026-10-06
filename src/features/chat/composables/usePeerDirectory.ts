import { reactive, type Ref } from 'vue'
import { getUserById } from '../../../services/api'
import type { UiConversation, UserApiItem } from '../../../types/chat'
import { normalizeUsername } from '../../../utils/username'

export type PeerMeta = {
  username: string
  displayName: string | null
  avatarUrl: string | null
  lastSeenUtc: string | null
  lastSeenHidden: boolean
}

type UsePeerDirectoryOptions = {
  conversations: Ref<UiConversation[]>
}

/**
 * What the chat page knows about other users: display names, avatars, last seen
 * and who is online. Profiles are fetched once per user and shared by all callers.
 */
export function usePeerDirectory({ conversations }: UsePeerDirectoryOptions) {
  const onlineIds = reactive(new Set<string>())

  const lastSeenMap = reactive<Record<string, string | null>>({})

  /** Users whose privacy settings hide their last seen from us ("last seen recently"). */
  const hiddenLastSeen = reactive(new Set<string>())

  const avatarById  = reactive<Record<string, string | null>>({})

  const displayById = reactive<Record<string, string | null>>({})

  const loadedPeerIds = new Set<string>()

  const peerRequests = new Map<string, Promise<PeerMeta | null>>()

  let peerCacheGeneration = 0

  function cachedPeerMeta(userId: string): PeerMeta {
    const conversation = conversations.value.find(item => item.peerId === userId)

    return {
      username: conversation?.username ?? '',
      displayName: displayById[userId] ?? conversation?.displayName ?? null,
      avatarUrl: avatarById[userId] ?? conversation?.avatarUrl ?? null,
      lastSeenUtc: lastSeenMap[userId] ?? null,
      lastSeenHidden: hiddenLastSeen.has(userId)
    }
  }

  function normalizePeerMeta(user: UserApiItem): PeerMeta {
    return {
      username: normalizeUsername(user.username ?? user.Username ?? ''),
      displayName: (user.displayName ?? user.DisplayName ?? '').trim() || null,
      avatarUrl: user.avatarUrl ?? user.AvatarUrl ?? null,
      lastSeenUtc: user.lastSeenUtc ?? user.LastSeenUtc ?? null,
      lastSeenHidden: !!user.lastSeenHidden
    }
  }

  function applyPeerMeta(userId: string, meta: PeerMeta) {
    displayById[userId] = meta.displayName ?? displayById[userId] ?? null
    avatarById[userId] = meta.avatarUrl ?? avatarById[userId] ?? null

    if (meta.lastSeenUtc) lastSeenMap[userId] = meta.lastSeenUtc
    if (meta.lastSeenHidden) hidePresence(userId)
    else hiddenLastSeen.delete(userId)

    const conversation = conversations.value.find(item => item.peerId === userId)
    if (!conversation) return

    if (meta.username) conversation.username = meta.username
    if (meta.displayName) conversation.displayName = meta.displayName
    if (meta.avatarUrl) conversation.avatarUrl = meta.avatarUrl
  }

  function cachePeerUser(user: UserApiItem) {
    const userId = String(user.id ?? user.Id ?? '')
    if (!userId) return

    loadedPeerIds.add(userId)
    applyPeerMeta(userId, normalizePeerMeta(user))
  }

  async function ensurePeerCached(userId: string): Promise<PeerMeta | null> {
    if (!userId) return null
    if (loadedPeerIds.has(userId)) return cachedPeerMeta(userId)

    const pending = peerRequests.get(userId)
    if (pending) return pending

    const generation = peerCacheGeneration

    const request = (async () => {
      try {
        const user = await getUserById(userId)
        const meta = normalizePeerMeta(user)

        if (generation === peerCacheGeneration) {
          cachePeerUser(user)
        }

        return meta
      } catch {
        return null
      }
    })()

    peerRequests.set(userId, request)

    void request.finally(() => {
      if (peerRequests.get(userId) === request) peerRequests.delete(userId)
    })

    return request
  }

  function markOnline(userId: string) {
    onlineIds.add(String(userId))
    hiddenLastSeen.delete(String(userId))
  }

  function markOffline(userId: string, when?: string | null) {
    const id = String(userId)
    onlineIds.delete(id)
    if (when) {
      lastSeenMap[id] = when
      hiddenLastSeen.delete(id)
    }
  }

  /** The user stopped sharing presence with us. */
  function hidePresence(userId: string) {
    const id = String(userId)
    onlineIds.delete(id)
    delete lastSeenMap[id]
    hiddenLastSeen.add(id)
  }

  function setOnlineSnapshot(ids: string[]) {
    onlineIds.clear()
    ids.forEach(id => onlineIds.add(String(id)))
  }

  function setLastSeen(userId: string, whenIso: string) {
    lastSeenMap[String(userId)] = whenIso
    hiddenLastSeen.delete(String(userId))
  }

  /** Forgets everything, e.g. when the signed-in user changes. */
  function resetPeers() {
    peerCacheGeneration++
    loadedPeerIds.clear()
    peerRequests.clear()

    for (const key in displayById) delete displayById[key]
    for (const key in avatarById) delete avatarById[key]
    for (const key in lastSeenMap) delete lastSeenMap[key]

    onlineIds.clear()
    hiddenLastSeen.clear()
  }

  return {
    onlineIds,
    lastSeenMap,
    hiddenLastSeen,
    avatarById,
    displayById,
    cachePeerUser,
    ensurePeerCached,
    markOnline,
    markOffline,
    setOnlineSnapshot,
    setLastSeen,
    hidePresence,
    resetPeers
  }
}
