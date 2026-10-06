import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import {
  createIdentityKey,
  getActiveIdentityKey,
  getErrorCode,
  getGroupMemberKeys,
  getIdentityKeyById,
  getMyIdentityKey,
  replaceIdentityKey,
  updateKeyBackup,
  type MyIdentityKey
} from '../services/api'
import { deleteIdentity, deleteOtherIdentities, loadIdentity, saveIdentity } from '../services/e2ee/keyStore'
import { openMessage, parseMessage, sealMessage, type MessageEnvelope } from '../services/e2ee/messageCodec'
import { isGroupMessage, openGroupMessage, parseGroupMessage, sealGroupMessage } from '../services/e2ee/groupCodec'
import { isGroupChat } from '../services/chatKinds'
import {
  createBackup,
  deriveConversationKey,
  E2eeError,
  generateIdentity,
  GROUP_KEY_WRAP_INFO,
  importPeerPublicKey,
  openBackup,
  safetyNumber,
  type IdentityKeyPair
} from '../services/e2ee/primitives'
import { getTrust, setTrust } from '../services/e2ee/trust'

/**
 * - checking: looking up this device's key and the server's copy
 * - setup:    the account has no key yet; the user picks a recovery passphrase
 * - restore:  the account has a key, this device does not; the user enters the passphrase
 * - ready:    messages can be encrypted and decrypted
 * - error:    the check failed (e.g. offline); it can be retried
 */
export type E2eeStatus = 'idle' | 'checking' | 'setup' | 'restore' | 'ready' | 'error'

/** Result of opening a received message. */
export type OpenedMessage =
  | { state: 'ok'; envelope: MessageEnvelope }
  /** Sent before end-to-end encryption existed; its key was deleted. */
  | { state: 'legacy' }
  /** Encrypted for one of my earlier keys, which this account no longer has. */
  | { state: 'old-key' }
  | { state: 'failed' }

type PeerKey = { keyId: string; publicKeySpki: string; publicKey: CryptoKey }

type GroupMemberKey = { userId: string; key: PeerKey }

/** Errors that mean "encrypt again with fresh keys and resend". */
const STALE_KEY_CODES = new Set(['recipient_key_changed', 'group_keys_changed'])

export const MIN_PASSPHRASE_LENGTH = 8

export const useE2eeStore = defineStore('e2ee', () => {
  const status = ref<E2eeStatus>('idle')
  const userId = ref('')
  const identity = ref<IdentityKeyPair | null>(null)

  /** The account's server-side key while it waits to be restored on this device. */
  let pendingServerKey: MyIdentityKey | null = null

  /** Peers whose key differs from the one seen before (until the user acknowledges it). */
  const keyChanged = reactive<Record<string, boolean>>({})
  /** Peers known to have no key yet (they cannot receive messages). */
  const peerMissingKey = reactive<Record<string, boolean>>({})

  const activePeerKeys = new Map<string, Promise<PeerKey | null>>()
  const peerKeysById = new Map<string, Promise<PeerKey>>()
  const conversationKeys = new Map<string, Promise<CryptoKey>>()
  /** Pairwise keys that wrap group message keys (another HKDF label than private chats). */
  const wrapKeys = new Map<string, Promise<CryptoKey>>()
  const groupMemberKeys = new Map<string, Promise<GroupMemberKey[]>>()

  let readyWaiters: Array<() => void> = []

  function setStatus(next: E2eeStatus) {
    status.value = next
    if (next === 'ready') {
      for (const resolve of readyWaiters.splice(0)) resolve()
    }
  }

  /** Resolves once the key is ready (immediately if it already is). */
  function whenReady(): Promise<void> {
    return status.value === 'ready' ? Promise.resolve() : new Promise(resolve => readyWaiters.push(resolve))
  }

  function clearCaches() {
    activePeerKeys.clear()
    peerKeysById.clear()
    conversationKeys.clear()
    wrapKeys.clear()
    groupMemberKeys.clear()
    for (const id of Object.keys(keyChanged)) delete keyChanged[id]
    for (const id of Object.keys(peerMissingKey)) delete peerMissingKey[id]
  }

  // ---------- own identity ----------

  /** Decides between ready / setup / restore for the signed-in user. */
  async function init(currentUserId: string): Promise<void> {
    if (!currentUserId) return
    if (userId.value !== currentUserId) {
      clearCaches()
      identity.value = null
    }
    userId.value = currentUserId
    setStatus('checking')

    try {
      await deleteOtherIdentities(currentUserId)

      const [server, local] = await Promise.all([getMyIdentityKey(), loadIdentity(currentUserId)])
      if (userId.value !== currentUserId) return

      pendingServerKey = server

      if (!server) {
        // Nothing published (a local key without a server copy is useless to peers).
        if (local) await deleteIdentity(currentUserId)
        identity.value = null
        setStatus('setup')
        return
      }

      if (local && local.keyId === server.keyId) {
        identity.value = local
        pendingServerKey = null
        setStatus('ready')
        return
      }

      // The key was replaced on another device, or this device never had it.
      if (local) await deleteIdentity(currentUserId)
      identity.value = null
      setStatus('restore')
    } catch (error) {
      console.warn('e2ee init failed', error)
      if (userId.value === currentUserId) setStatus('error')
    }
  }

  async function adopt(next: IdentityKeyPair) {
    await saveIdentity(userId.value, next)
    identity.value = next
    pendingServerKey = null
    conversationKeys.clear()
    setStatus('ready')
  }

  function assertPassphrase(passphrase: string) {
    if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) throw new E2eeError('passphrase_too_short')
  }

  /** First-time setup: create a key and store its backup encrypted with `passphrase`. */
  async function setup(passphrase: string): Promise<void> {
    assertPassphrase(passphrase)
    const { identity: created, pkcs8 } = await generateIdentity()
    const backup = await createBackup(pkcs8, created.keyId, passphrase)

    try {
      await createIdentityKey({ publicKey: created.publicKeySpki, backup })
    } catch (error) {
      // Another device finished setup first: restore that key instead.
      if (getErrorCode(error) === 'identity_key_exists') {
        await init(userId.value)
        throw new E2eeError('identity_key_exists')
      }
      throw error
    }

    await adopt(created)
  }

  /** Restores the account's key on this device. Throws E2eeError('wrong_passphrase'). */
  async function restore(passphrase: string): Promise<void> {
    const server = pendingServerKey ?? await getMyIdentityKey()
    if (!server) {
      setStatus('setup')
      throw new E2eeError('no_identity_key')
    }

    const { identity: restored } = await openBackup(server.backup, server.keyId, server.publicKey, passphrase)
    await adopt(restored)
  }

  /**
   * Replaces the key when the passphrase is lost. Messages encrypted for the old key can no
   * longer be read on any device, and contacts are warned that the key changed.
   */
  async function reset(passphrase: string): Promise<void> {
    assertPassphrase(passphrase)
    const { identity: created, pkcs8 } = await generateIdentity()
    const backup = await createBackup(pkcs8, created.keyId, passphrase)
    await replaceIdentityKey({ publicKey: created.publicKeySpki, backup })
    await adopt(created)
  }

  /** Re-encrypts the backup with a new passphrase; the old one is needed to open it. */
  async function changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<void> {
    assertPassphrase(newPassphrase)
    const server = await getMyIdentityKey()
    if (!server || server.keyId !== identity.value?.keyId) throw new E2eeError('identity_key_changed')

    const { pkcs8 } = await openBackup(server.backup, server.keyId, server.publicKey, oldPassphrase)
    const backup = await createBackup(pkcs8, server.keyId, newPassphrase)
    await updateKeyBackup(server.keyId, backup)
  }

  /** Forgets everything in memory (sign-out); the stored key is removed by logout(). */
  function resetState() {
    clearCaches()
    identity.value = null
    pendingServerKey = null
    userId.value = ''
    setStatus('idle')
  }

  // ---------- peer keys ----------

  function rememberPeerKey(peerId: string, key: PeerKey) {
    peerKeysById.set(`${peerId}:${key.keyId}`, Promise.resolve(key))

    const owner = userId.value
    if (!owner || peerId === owner) return

    const trusted = getTrust(owner, peerId)
    if (!trusted) {
      setTrust(owner, peerId, { keyId: key.keyId, verified: false })
    } else if (trusted.keyId !== key.keyId) {
      keyChanged[peerId] = true
    }
  }

  /** The peer's current key (cached). Null when they have not set up encryption. */
  function getActivePeerKey(peerId: string, refresh = false): Promise<PeerKey | null> {
    if (peerId === userId.value && identity.value) {
      const me = identity.value
      return getPeerKeyById(peerId, me.keyId).then(key => key ?? null)
    }

    const cached = activePeerKeys.get(peerId)
    if (cached && !refresh) return cached

    const request = (async () => {
      const dto = await getActiveIdentityKey(peerId)
      if (!dto) {
        peerMissingKey[peerId] = true
        return null
      }
      delete peerMissingKey[peerId]

      const key = { keyId: dto.keyId, publicKeySpki: dto.publicKey, publicKey: await importPeerPublicKey(dto.publicKey, dto.keyId) }
      rememberPeerKey(peerId, key)
      return key
    })()

    activePeerKeys.set(peerId, request)
    // Failures and "no key yet" are not cached, so the next attempt asks again.
    request.then(key => { if (!key) activePeerKeys.delete(peerId) }, () => activePeerKeys.delete(peerId))
    return request
  }

  /** A specific key of a peer. Key ids are hashes, so the fetched key is verified against it. */
  function getPeerKeyById(peerId: string, keyId: string): Promise<PeerKey> {
    const cacheKey = `${peerId}:${keyId}`
    const cached = peerKeysById.get(cacheKey)
    if (cached) return cached

    const request = (async () => {
      if (peerId === userId.value && identity.value?.keyId === keyId) {
        const me = identity.value
        return { keyId, publicKeySpki: me.publicKeySpki, publicKey: await importPeerPublicKey(me.publicKeySpki, keyId) }
      }
      const dto = await getIdentityKeyById(peerId, keyId)
      return { keyId, publicKeySpki: dto.publicKey, publicKey: await importPeerPublicKey(dto.publicKey, keyId) }
    })()

    peerKeysById.set(cacheKey, request)
    request.catch(() => peerKeysById.delete(cacheKey))
    return request
  }

  function conversationKey(peer: PeerKey): Promise<CryptoKey> {
    const me = identity.value
    if (!me) return Promise.reject(new E2eeError('not_ready'))

    const cacheKey = `${me.keyId}:${peer.keyId}`
    let key = conversationKeys.get(cacheKey)
    if (!key) {
      key = deriveConversationKey(me.privateKey, peer.publicKey, me.keyId, peer.keyId)
      conversationKeys.set(cacheKey, key)
      key.catch(() => conversationKeys.delete(cacheKey))
    }
    return key
  }

  function wrapKey(peer: PeerKey): Promise<CryptoKey> {
    const me = identity.value
    if (!me) return Promise.reject(new E2eeError('not_ready'))

    const cacheKey = `${me.keyId}:${peer.keyId}`
    let key = wrapKeys.get(cacheKey)
    if (!key) {
      key = deriveConversationKey(me.privateKey, peer.publicKey, me.keyId, peer.keyId, GROUP_KEY_WRAP_INFO)
      wrapKeys.set(cacheKey, key)
      key.catch(() => wrapKeys.delete(cacheKey))
    }
    return key
  }

  /** The current keys of a group's members (cached until the group or a key changes). */
  function getGroupKeys(groupId: string, refresh = false): Promise<GroupMemberKey[]> {
    const cached = groupMemberKeys.get(groupId)
    if (cached && !refresh) return cached

    const request = (async () => {
      const dtos = await getGroupMemberKeys(groupId)
      return Promise.all(dtos.map(async dto => {
        const key = { keyId: dto.keyId, publicKeySpki: dto.publicKey, publicKey: await importPeerPublicKey(dto.publicKey, dto.keyId) }
        // Members are trusted on first use like private-chat peers; a changed key is flagged.
        rememberPeerKey(dto.userId, key)
        return { userId: dto.userId, key }
      }))
    })()

    groupMemberKeys.set(groupId, request)
    request.catch(() => groupMemberKeys.delete(groupId))
    return request
  }

  /** Forgets a group's member keys, e.g. after members joined or left. */
  function invalidateGroupKeys(groupId?: string) {
    if (groupId) groupMemberKeys.delete(groupId)
    else groupMemberKeys.clear()
  }

  /** Called when the server announces a new key for `changedUserId`. */
  async function onIdentityKeyChanged(changedUserId: string, keyId: string) {
    invalidateGroupKeys()

    if (changedUserId === userId.value) {
      // Replaced on another device: this device's key is now useless.
      if (identity.value && identity.value.keyId !== keyId) await init(userId.value)
      return
    }

    activePeerKeys.delete(changedUserId)
    await getActivePeerKey(changedUserId, true).catch(() => null)
  }

  // ---------- messages ----------

  /** Encrypts `envelope` for every current member of the group. */
  async function sealGroup(groupId: string, envelope: MessageEnvelope, refresh = false): Promise<string> {
    const me = identity.value
    if (!me || status.value !== 'ready') throw new E2eeError('not_ready')

    const members = await getGroupKeys(groupId, refresh)
    // Like a private chat, nothing is sent to a changed key until the user accepts it.
    if (members.some(member => member.userId !== userId.value && keyChanged[member.userId])) {
      throw new E2eeError('member_key_changed')
    }

    const recipients = await Promise.all(members.map(async member => ({ keyId: member.key.keyId, wrapKey: await wrapKey(member.key) })))
    return sealGroupMessage(groupId, me.keyId, recipients, envelope)
  }

  /** Encrypts `envelope` for `peerId`'s current key (or for the members when it is a group). */
  async function seal(peerId: string, envelope: MessageEnvelope, refresh = false): Promise<string> {
    if (isGroupChat(peerId)) return sealGroup(peerId, envelope, refresh)

    const me = identity.value
    if (!me || status.value !== 'ready') throw new E2eeError('not_ready')

    const peer = await getActivePeerKey(peerId, refresh)
    if (!peer) throw new E2eeError('recipient_no_key')

    return sealMessage(await conversationKey(peer), me.keyId, peer.keyId, envelope)
  }

  /**
   * Encrypts and sends. If the server says the peer's key changed meanwhile, the key is
   * fetched again and the message re-encrypted once. Our own key being outdated means another
   * device replaced it: the store re-checks so the user can restore the new one.
   */
  async function sealAndSend(peerId: string, envelope: MessageEnvelope, send: (body: string) => Promise<unknown>): Promise<void> {
    try {
      await send(await seal(peerId, envelope))
    } catch (error) {
      const code = getErrorCode(error)
      if (code && STALE_KEY_CODES.has(code)) {
        await send(await seal(peerId, envelope, true))
        return
      }
      if (code === 'sender_key_outdated') void init(userId.value)
      throw error
    }
  }

  /**
   * Decrypts a message between me and `peerId`. `senderId` decides which key id in the
   * header must be mine, so a message cannot be re-attributed to the other side.
   */
  async function open(raw: string | null | undefined, senderId: string, peerId: string): Promise<OpenedMessage> {
    if (isGroupMessage(raw)) return openGroup(raw!, senderId, peerId)

    const header = parseMessage(raw)
    if (!header) return { state: 'legacy' }

    const me = identity.value
    if (!me) return { state: 'failed' }

    const sentByMe = senderId === userId.value
    const myKeyId = sentByMe ? header.senderKeyId : header.recipientKeyId
    const peerKeyId = sentByMe ? header.recipientKeyId : header.senderKeyId

    if (myKeyId !== me.keyId) return { state: 'old-key' }

    try {
      const peer = await getPeerKeyById(peerId, peerKeyId)
      const envelope = await openMessage(await conversationKey(peer), header)
      return { state: 'ok', envelope }
    } catch (error) {
      console.warn('decrypt failed', error)
      return { state: 'failed' }
    }
  }

  /** Decrypts a message of group `groupId` sent by `senderId`. */
  async function openGroup(raw: string, senderId: string, groupId: string): Promise<OpenedMessage> {
    const header = parseGroupMessage(raw)
    const me = identity.value
    if (!header || !me) return { state: 'failed' }

    // Not wrapped for this key: sent before this account's key was replaced.
    if (!header.wrapped.has(me.keyId)) return { state: 'old-key' }

    try {
      const sender = await getPeerKeyById(senderId, header.senderKeyId)
      const envelope = await openGroupMessage(groupId, header, me.keyId, await wrapKey(sender))
      return { state: 'ok', envelope }
    } catch (error) {
      console.warn('group decrypt failed', error)
      return { state: 'failed' }
    }
  }

  // ---------- verification ----------

  async function securityCode(peerId: string): Promise<{ groups: string[]; keyId: string } | null> {
    const me = identity.value
    const peer = await getActivePeerKey(peerId)
    if (!me || !peer) return null
    return { groups: await safetyNumber(me.publicKeySpki, peer.publicKeySpki), keyId: peer.keyId }
  }

  function isVerified(peerId: string, keyId: string): boolean {
    const trusted = getTrust(userId.value, peerId)
    return !!trusted && trusted.keyId === keyId && trusted.verified
  }

  /** Accepts the peer's current key (dismisses the change warning), optionally as verified. */
  async function trustPeerKey(peerId: string, verified: boolean) {
    const peer = await getActivePeerKey(peerId)
    if (!peer) return
    setTrust(userId.value, peerId, { keyId: peer.keyId, verified })
    delete keyChanged[peerId]
  }

  return {
    status,
    userId,
    identity,
    keyChanged,
    peerMissingKey,

    whenReady,
    init,
    setup,
    restore,
    reset,
    changePassphrase,
    resetState,

    getActivePeerKey,
    onIdentityKeyChanged,
    invalidateGroupKeys,
    getGroupKeys,

    seal,
    sealAndSend,
    open,

    securityCode,
    isVerified,
    trustPeerKey
  }
})
