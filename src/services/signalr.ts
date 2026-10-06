import {
  HubConnectionBuilder,
  HubConnectionState
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { CHAT_HUB_URL } from '../config/server'
import { getValidAccessToken } from './api'
import { isGroupChat } from './chatKinds'

type Handler<TArgs extends unknown[]> = (
  ...args: TArgs
) => void | Promise<void>

type TypingPayload = {
  SenderId: string
  /** Set when the typing happens in a group. */
  GroupId?: string
  At?: string
}

type EditedPayload = {
  messageId: string
  encryptedContent: string
  updatedAtUtc?: string
}

type DeletedPayload = {
  messageId: string
  scope: 'me' | 'all'
}

/** The full reaction list of a message after a change (see ReactionSnapshot in api.ts). */
type ReactionPayload = {
  messageId: string
  reactions: Array<{ emoji: string; count: number; userIds: string[] }>
  version: number
}

export type PinsChangedPayload = {
  messageId: string
  pinned: boolean
  by: string
  senderId: string
  /** Null for a group message. */
  receiverId: string | null
  groupId?: string | null
}

export type BlockListChangedPayload = {
  userId: string
  blocked: boolean
}

export type GroupEventPayload = {
  groupId: string
}

export type GroupReadPayload = {
  groupId: string
  readerId: string
  readUpToUtc: string
}

export type MutesChangedPayload = {
  chatId: string
  muted: boolean
}

export type IdentityKeyChangedPayload = {
  userId: string
  keyId: string
}

let connection: HubConnection | null = null
let connectPromise: Promise<void> | null = null

let activeToken: string | null = null
let reconnectTimer: number | null = null
let manualDisconnect = false

// Reconnect backoff after the connection is lost: 1.5s, 3s, 6s ... capped at 30s.
let reconnectAttempt = 0
const RECONNECT_BASE_MS = 1500
const RECONNECT_MAX_MS = 30_000

function nextReconnectDelay() {
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempt)
  reconnectAttempt++
  // Jitter so many clients do not reconnect in lockstep after a server restart.
  return delay * (0.8 + Math.random() * 0.4)
}

const messageReceivedHandlers = new Set<Handler<[any]>>()
const deliveredHandlers = new Set<Handler<[any]>>()
const messageReadHandlers = new Set<Handler<[any]>>()
const onlineSnapshotHandlers = new Set<Handler<[string[]]>>()
const userOnlineHandlers = new Set<Handler<[string, string]>>()
const userOfflineHandlers = new Set<Handler<[string, string]>>()
const typingHandlers = new Set<Handler<[TypingPayload]>>()
const typingStoppedHandlers = new Set<Handler<[TypingPayload]>>()
const userLastSeenHandlers = new Set<Handler<[string, string]>>()
const messageEditedHandlers = new Set<Handler<[EditedPayload]>>()
const messageDeletedHandlers = new Set<Handler<[DeletedPayload]>>()
const reactionUpdatedHandlers = new Set<Handler<[ReactionPayload]>>()
const identityKeyChangedHandlers = new Set<Handler<[IdentityKeyChangedPayload]>>()
const pinsChangedHandlers = new Set<Handler<[PinsChangedPayload]>>()
const blockListChangedHandlers = new Set<Handler<[BlockListChangedPayload]>>()
const presenceHiddenHandlers = new Set<Handler<[string]>>()
const mutesChangedHandlers = new Set<Handler<[MutesChangedPayload]>>()
const sessionTerminatedHandlers = new Set<Handler<[]>>()
const groupUpdatedHandlers = new Set<Handler<[GroupEventPayload]>>()
const groupRemovedHandlers = new Set<Handler<[GroupEventPayload]>>()
const groupReadHandlers = new Set<Handler<[GroupReadPayload]>>()

function subscribe<TArgs extends unknown[]>(
  handlers: Set<Handler<TArgs>>,
  handler: Handler<TArgs>
) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

function createScopeMethod<TArgs extends unknown[]>(
  unsubscribers: Array<() => void>,
  handlers: Set<Handler<TArgs>>
) {
  return (handler: Handler<TArgs>) => {
    unsubscribers.push(subscribe(handlers, handler))
  }
}

function dispatch<TArgs extends unknown[]>(
  handlers: Set<Handler<TArgs>>,
  ...args: TArgs
) {
  for (const handler of handlers) {
    void Promise.resolve(handler(...args)).catch(() => {})
  }
}

function normalizeTyping(payload: any): TypingPayload {
  const senderId =
    payload?.SenderId ??
    payload?.senderId ??
    payload?.userId ??
    payload?.UserId

  const groupId = payload?.GroupId ?? payload?.groupId

  return {
    SenderId: String(senderId ?? ''),
    GroupId: groupId ? String(groupId) : undefined,
    At: payload?.At ?? payload?.at
  }
}

function clearReconnectTimer() {
  if (reconnectTimer === null) return

  window.clearTimeout(reconnectTimer)
  reconnectTimer = null
}

async function refreshOnlineSnapshot(
  current: HubConnection
) {
  try {
    const ids =
      await current.invoke<string[]>(
        'GetOnlineUsers'
      )

    if (connection === current) {
      dispatch(
        onlineSnapshotHandlers,
        ids.map(String)
      )
    }
  } catch {}
}

function scheduleReconnect() {
  if (
    manualDisconnect ||
    !activeToken ||
    reconnectTimer !== null
  ) {
    return
  }

  reconnectTimer =
    window.setTimeout(() => {
      reconnectTimer = null

      const token = activeToken

      if (
        !token ||
        manualDisconnect
      ) {
        return
      }

      void connectToChatHub(token)
        .catch(() => {
          scheduleReconnect()
        })
    }, nextReconnectDelay())
}

async function getConnectedHub():
  Promise<HubConnection> {
  const current = connection

  if (
    current?.state ===
    HubConnectionState.Connected
  ) {
    return current
  }

  if (connectPromise) {
    try {
      await connectPromise
    } catch {}
  }

  const afterPending = connection

  if (
    afterPending?.state ===
    HubConnectionState.Connected
  ) {
    return afterPending
  }

  if (!activeToken) {
    throw new Error(
      'SignalR token is not available'
    )
  }

  await connectToChatHub(activeToken)

  const connected = connection

  if (
    !connected ||
    connected.state !==
      HubConnectionState.Connected
  ) {
    throw new Error(
      'SignalR not connected'
    )
  }

  return connected
}

function bindConnection(current: HubConnection) {
  current.on('ReceiveMessage', payload =>
    dispatch(messageReceivedHandlers, payload)
  )

  current.on('Delivered', payload =>
    dispatch(deliveredHandlers, payload)
  )

  current.on('MessageRead', payload =>
    dispatch(messageReadHandlers, payload)
  )

  current.on('OnlineSnapshot', ids =>
    dispatch(onlineSnapshotHandlers, ids)
  )

  current.on('UserOnline', (userId, at) =>
    dispatch(userOnlineHandlers, userId, at)
  )

  current.on('UserOffline', (userId, at) =>
    dispatch(userOfflineHandlers, userId, at)
  )

  current.on('UserTyping', payload =>
    dispatch(
      typingHandlers,
      normalizeTyping(payload)
    )
  )

  current.on('UserStoppedTyping', payload =>
    dispatch(
      typingStoppedHandlers,
      normalizeTyping(payload)
    )
  )

  current.on('UserLastSeen', (userId, whenIso) =>
    dispatch(
      userLastSeenHandlers,
      userId,
      whenIso
    )
  )

  current.on('MessageEdited', payload =>
    dispatch(messageEditedHandlers, payload)
  )

  current.on('MessageDeleted', payload =>
    dispatch(messageDeletedHandlers, payload)
  )

  current.on('ReactionUpdated', payload =>
    dispatch(reactionUpdatedHandlers, payload)
  )

  current.on('IdentityKeyChanged', payload =>
    dispatch(identityKeyChangedHandlers, payload)
  )

  current.on('PinsChanged', payload =>
    dispatch(pinsChangedHandlers, payload)
  )

  current.on('BlockListChanged', payload =>
    dispatch(blockListChangedHandlers, payload)
  )

  // A user stopped sharing presence with us (privacy settings): forget their online state and last seen.
  current.on('PresenceHidden', userId =>
    dispatch(presenceHiddenHandlers, String(userId))
  )

  current.on('MutesChanged', payload =>
    dispatch(mutesChangedHandlers, payload)
  )

  // This sign-in was ended from another device.
  current.on('SessionTerminated', () =>
    dispatch(sessionTerminatedHandlers)
  )

  // A group's name, photo or members changed; or we are no longer a member.
  current.on('GroupUpdated', payload =>
    dispatch(groupUpdatedHandlers, { groupId: String(payload?.groupId ?? '') })
  )

  current.on('GroupRemoved', payload =>
    dispatch(groupRemovedHandlers, { groupId: String(payload?.groupId ?? '') })
  )

  current.on('GroupRead', payload =>
    dispatch(groupReadHandlers, {
      groupId: String(payload?.groupId ?? ''),
      readerId: String(payload?.readerId ?? ''),
      readUpToUtc: String(payload?.readUpToUtc ?? '')
    })
  )

  current.onreconnecting(() => {
    if (connection === current) {
      // هنگام قطع اتصال، وضعیت آنلاین
      // قبلی را معتبر فرض نکن.
      dispatch(
        onlineSnapshotHandlers,
        []
      )
    }
  })

  current.onreconnected(() => {
    if (connection === current) {
      void refreshOnlineSnapshot(
        current
      )
    }
  })

  current.onclose(() => {
    if (connection !== current) {
      return
    }

    connection = null
    connectPromise = null

    scheduleReconnect()
  })
}

export function createChatHubSubscriptionScope() {
  const unsubscribers: Array<() => void> = []

  return {
    onMessageReceived: createScopeMethod(
      unsubscribers,
      messageReceivedHandlers
    ),

    onDelivered: createScopeMethod(
      unsubscribers,
      deliveredHandlers
    ),

    onMessageRead: createScopeMethod(
      unsubscribers,
      messageReadHandlers
    ),

    onOnlineSnapshot: createScopeMethod(
      unsubscribers,
      onlineSnapshotHandlers
    ),

    onUserOnline: createScopeMethod(
      unsubscribers,
      userOnlineHandlers
    ),

    onUserOffline: createScopeMethod(
      unsubscribers,
      userOfflineHandlers
    ),

    onTyping: createScopeMethod(
      unsubscribers,
      typingHandlers
    ),

    onTypingStopped: createScopeMethod(
      unsubscribers,
      typingStoppedHandlers
    ),

    onUserLastSeen: createScopeMethod(
      unsubscribers,
      userLastSeenHandlers
    ),

    onMessageEdited: createScopeMethod(
      unsubscribers,
      messageEditedHandlers
    ),

    onMessageDeleted: createScopeMethod(
      unsubscribers,
      messageDeletedHandlers
    ),

    onReactionUpdated: createScopeMethod(
      unsubscribers,
      reactionUpdatedHandlers
    ),

    onIdentityKeyChanged: createScopeMethod(
      unsubscribers,
      identityKeyChangedHandlers
    ),

    onPinsChanged: createScopeMethod(
      unsubscribers,
      pinsChangedHandlers
    ),

    onBlockListChanged: createScopeMethod(
      unsubscribers,
      blockListChangedHandlers
    ),

    onPresenceHidden: createScopeMethod(
      unsubscribers,
      presenceHiddenHandlers
    ),

    onMutesChanged: createScopeMethod(
      unsubscribers,
      mutesChangedHandlers
    ),

    onSessionTerminated: createScopeMethod(
      unsubscribers,
      sessionTerminatedHandlers
    ),

    onGroupUpdated: createScopeMethod(
      unsubscribers,
      groupUpdatedHandlers
    ),

    onGroupRemoved: createScopeMethod(
      unsubscribers,
      groupRemovedHandlers
    ),

    onGroupRead: createScopeMethod(
      unsubscribers,
      groupReadHandlers
    ),

    dispose() {
      for (const unsubscribe of unsubscribers.splice(0)) {
        unsubscribe()
      }
    }
  }
}

export async function connectToChatHub(
  token: string
) {
  activeToken = token
  manualDisconnect = false

  clearReconnectTimer()

  if (
    connection?.state ===
    HubConnectionState.Connected
  ) {
    return
  }

  if (connectPromise) {
    return connectPromise
  }

  const previous = connection
  connection = null

  if (previous) {
    try {
      await previous.stop()
    } catch {}
  }

  const next =
    new HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, {
        // Called on every (re)connect. The server closes connections whose token
        // expired, so always hand out a fresh one.
        accessTokenFactory: async () => {
          const fresh = await getValidAccessToken()
          if (fresh && activeToken) activeToken = fresh
          return fresh ?? activeToken ?? token
        }
      })
      .withAutomaticReconnect()
      .build()

  bindConnection(next)
  connection = next

  const pending = next
    .start()
    .then(async () => {
      if (connection !== next) {
        await next.stop()
        return
      }

      reconnectAttempt = 0

      await refreshOnlineSnapshot(
        next
      )
    })
    .catch(error => {
      if (connection === next) {
        connection = null
      }

      scheduleReconnect()
      throw error
    })

  connectPromise = pending

  try {
    await pending
  } finally {
    if (
      connectPromise === pending
    ) {
      connectPromise = null
    }
  }
}

export async function sendMessage(
  receiverId: string,
  encryptedText: string,
  fileUrl?: string | null,
  clientId?: string | null,
  replyToMessageId?: string | null,
  forwardedFromMessageId?: string | null
) {
  const current =
    await getConnectedHub()

  // `receiverId` is the chat id: a group's messages go out with its groupId instead.
  const target = isGroupChat(receiverId)
    ? { groupId: receiverId }
    : { receiverId }

  await current.invoke(
    'SendMessage',
    {
      ...target,
      encryptedText,

      fileUrl:
        fileUrl ?? null,

      clientId:
        clientId ?? null,

      replyToMessageId:
        replyToMessageId ?? null,

      forwardedFromMessageId:
        forwardedFromMessageId ??
        null
    }
  )
}

export async function markAsRead(
  messageId: string
) {
  const current =
    await getConnectedHub()

  await current.invoke(
    'MarkMessageAsRead',
    messageId
  )
}

/** Moves my read position in a group up to `messageId`. */
export async function markGroupRead(
  groupId: string,
  messageId: string
) {
  const current =
    await getConnectedHub()

  await current.invoke(
    'MarkGroupRead',
    groupId,
    messageId
  )
}

export async function startTyping(
  receiverId: string
) {
  const current =
    await getConnectedHub()

  await current.invoke(
    isGroupChat(receiverId) ? 'StartGroupTyping' : 'StartTyping',
    receiverId
  )
}

export async function stopTyping(
  receiverId: string
) {
  const current =
    await getConnectedHub()

  await current.invoke(
    isGroupChat(receiverId) ? 'StopGroupTyping' : 'StopTyping',
    receiverId
  )
}

export async function fetchOnlineUsers():
  Promise<string[]> {
  const current =
    await getConnectedHub()

  const ids =
    await current.invoke<string[]>(
      'GetOnlineUsers'
    )

  return ids.map(String)
}

export async function disconnectFromChatHub() {
  manualDisconnect = true
  activeToken = null

  clearReconnectTimer()

  const current = connection

  connection = null
  connectPromise = null

  try {
    await current?.stop()
  } catch {}
}