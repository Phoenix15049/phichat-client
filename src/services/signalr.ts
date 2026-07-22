import {
  HubConnectionBuilder,
  HubConnectionState
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { CHAT_HUB_URL } from '../config/server'

type Handler<TArgs extends unknown[]> = (
  ...args: TArgs
) => void | Promise<void>

type TypingPayload = {
  SenderId: string
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

type ReactionPayload = {
  messageId: string
  emoji: string
  count: number
  userId: string
  action: 'added' | 'removed'
}

let connection: HubConnection | null = null
let connectPromise: Promise<void> | null = null

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

  return {
    SenderId: String(senderId ?? ''),
    At: payload?.At ?? payload?.at
  }
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

    dispose() {
      for (const unsubscribe of unsubscribers.splice(0)) {
        unsubscribe()
      }
    }
  }
}

export async function connectToChatHub(token: string) {
  if (
    connection?.state === HubConnectionState.Connected
  ) {
    return
  }

  if (connectPromise) {
    return connectPromise
  }

  if (connection) {
    try {
      await connection.stop()
    } catch {}
  }

  const next = new HubConnectionBuilder()
    .withUrl(CHAT_HUB_URL, {
      accessTokenFactory: () => token
    })
    .withAutomaticReconnect()
    .build()

  bindConnection(next)
  connection = next

  const pending = next.start().then(async () => {
    if (connection !== next) {
      await next.stop()
    }
  })

  connectPromise = pending

  try {
    await pending
  } finally {
    if (connectPromise === pending) {
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
  if (!connection) {
    throw new Error('SignalR not connected')
  }

  await connection.invoke('SendMessage', {
    receiverId,
    encryptedText,
    fileUrl: fileUrl ?? null,
    clientId: clientId ?? null,
    replyToMessageId: replyToMessageId ?? null,
    forwardedFromMessageId:
      forwardedFromMessageId ?? null
  })
}

export async function markAsRead(messageId: string) {
  if (!connection) {
    throw new Error('SignalR not connected')
  }

  await connection.invoke(
    'MarkMessageAsRead',
    messageId
  )
}

export async function startTyping(receiverId: string) {
  await connection?.invoke(
    'StartTyping',
    receiverId
  )
}

export async function stopTyping(receiverId: string) {
  await connection?.invoke(
    'StopTyping',
    receiverId
  )
}

export async function fetchOnlineUsers(): Promise<string[]> {
  if (!connection) {
    throw new Error('SignalR not connected')
  }

  return connection.invoke<string[]>(
    'GetOnlineUsers'
  )
}

export async function disconnectFromChatHub() {
  const current = connection

  connection = null
  connectPromise = null

  try {
    await current?.stop()
  } catch {}
}