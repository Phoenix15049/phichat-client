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

let activeToken: string | null = null
let reconnectTimer: number | null = null
let manualDisconnect = false

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
    }, 1500)
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
        accessTokenFactory: () =>
          activeToken ?? token
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

  await current.invoke(
    'SendMessage',
    {
      receiverId,
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

export async function startTyping(
  receiverId: string
) {
  const current =
    await getConnectedHub()

  await current.invoke(
    'StartTyping',
    receiverId
  )
}

export async function stopTyping(
  receiverId: string
) {
  const current =
    await getConnectedHub()

  await current.invoke(
    'StopTyping',
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