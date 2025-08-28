// src/services/signalr.ts
import { HubConnectionBuilder, HubConnection, HubConnectionState } from '@microsoft/signalr'

let connection: HubConnection | null = null
let started = false

let deliveredHandler: ((p: DeliveredPayload) => void) | null = null;
let readHandler: ((p: MessageReadPayload) => void) | null = null;

// Handlers registered before connection starts are queued here
const pendingSubs: Array<(c: HubConnection) => void> = []

function normTyping(p: any): { SenderId: string; At?: string } {
  const sid = p?.SenderId ?? p?.senderId ?? p?.userId ?? p?.UserId
  return { SenderId: String(sid ?? ''), At: p?.At ?? p?.at }
}

function flushPending() {
  if (!connection) return
  for (const sub of pendingSubs) sub(connection)
  pendingSubs.length = 0
}

export async function connectToChatHub(token: string) {
  // idempotent connect
  if (connection && (connection.state === HubConnectionState.Connected || started)) return

  connection = new HubConnectionBuilder()
    .withUrl('https://localhost:7146/chat', { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build()

  connection.onclose(err => console.warn('SignalR closed', err))
  connection.onreconnecting(err => console.warn('SignalR reconnecting', err))
  connection.onreconnected(id => {
    console.log('SignalR reconnected', id)
    // handlers remain, but flush queued subs (if any)
    flushPending()
  })

  await connection.start()
  started = true
  
  console.log('✅ Connected to SignalR')
  connection.on('UserTyping',  (raw: any) => console.debug('🌐 core UserTyping', normTyping(raw)))
  connection.on('UserStoppedTyping', (raw: any) => console.debug('🌐 core UserStoppedTyping', normTyping(raw)))
  flushPending()
}

/* ---------------- Messages ---------------- */

// ReceiveMessage(payload)
export function onMessageReceived(cb: (msg: any) => void) {
  const sub = (c: HubConnection) =>
    c.on('ReceiveMessage', (m: any) => {
      // console.debug('🔔 ReceiveMessage', m)
      cb(m)
    })
  if (connection) sub(connection); else pendingSubs.push(sub)
}
export function offMessageReceived(cb: (msg: any) => void) {
  connection?.off('ReceiveMessage', cb as any)
}

// Delivered({ messageId, receiverId, sentAt, clientId? })
export function onDelivered(cb: (info: any) => void) {
  const sub = (c: HubConnection) =>
    c.on('Delivered', (i: any) => {
      // console.debug('🔔 Delivered', i)
      cb(i)
    })
  if (connection) sub(connection); else pendingSubs.push(sub)
}

export function onMessageRead(cb: (info: any) => void) {
  const sub = (c: HubConnection) =>
    c.on('MessageRead', (i: any) => {
      // console.debug('🔔 MessageRead', i)
      cb(i)
    })
  if (connection) sub(connection); else pendingSubs.push(sub)
}

// Send a message via hub
export async function sendMessage(
  receiverId: string,
  encryptedText: string,
  fileUrl?: string | null,
  clientId?: string | null,
  replyToMessageId?: string | null,
  forwardedFromMessageId?: string | null
) {
  if (!connection) throw new Error('SignalR not connected')
  await connection.invoke('SendMessage', {
    receiverId,
    encryptedText,
    fileUrl: fileUrl ?? null,
    clientId: clientId ?? null,
    replyToMessageId: replyToMessageId ?? null,
    forwardedFromMessageId: forwardedFromMessageId ?? null
  })
}

// Mark a message as read
export async function markAsRead(messageId: string) {
  if (!connection) throw new Error('SignalR not connected')
  await connection.invoke('MarkMessageAsRead', messageId)
}

/* ---------------- Presence ---------------- */

// OnlineSnapshot(string[])
export function onOnlineSnapshot(cb: (ids: string[]) => void) {
  const sub = (c: HubConnection) => c.on('OnlineSnapshot', (ids: string[]) => cb(ids))
  if (connection) sub(connection); else pendingSubs.push(sub)
}

// UserOnline(userId, at)
export function onUserOnline(cb: (userId: string, at: string) => void) {
  const sub = (c: HubConnection) =>
    c.on('UserOnline', (uid: string, at: string) => {
      // console.debug('🔔 UserOnline', uid, at)
      cb(uid, at)
    })
  if (connection) sub(connection); else pendingSubs.push(sub)
}
export function offUserOnline(cb: (userId: string, at: string) => void) {
  connection?.off('UserOnline', cb as any)
}

// UserOffline(userId, at)
export function onUserOffline(cb: (userId: string, at: string) => void) {
  const sub = (c: HubConnection) =>
    c.on('UserOffline', (uid: string, at: string) => {
      // console.debug('🔔 UserOffline', uid, at)
      cb(uid, at)
    })
  if (connection) sub(connection); else pendingSubs.push(sub)
}
export function offUserOffline(cb: (userId: string, at: string) => void) {
  connection?.off('UserOffline', cb as any)
}

/* ---------------- Typing ---------------- */

// UserTyping({ SenderId, At })
export function onTyping(cb: (p: { SenderId: string; At?: string }) => void) {
  const sub = (c: HubConnection) => c.on('UserTyping', (raw: any) => cb(normTyping(raw)))
  if (connection) sub(connection); else pendingSubs.push(sub)
}

export function offTyping(cb: (payload: { SenderId: string; At: string }) => void) {
  connection?.off('UserTyping', cb as any)
}

// UserStoppedTyping({ SenderId, At })
export function onTypingStopped(cb: (p: { SenderId: string; At?: string }) => void) {
  const sub = (c: HubConnection) => c.on('UserStoppedTyping', (raw: any) => cb(normTyping(raw)))
  if (connection) sub(connection); else pendingSubs.push(sub)
}


export function offTypingStopped(cb: (payload: { SenderId: string; At: string }) => void) {
  connection?.off('UserStoppedTyping', cb as any)
}

// invoke typing from client
export async function startTyping(receiverId: string) {
  await connection?.invoke('StartTyping', receiverId)
}
export async function stopTyping(receiverId: string) {
  await connection?.invoke('StopTyping', receiverId)
}

export function onUserLastSeen(cb: (userId: string, whenIso: string) => void) {
  const sub = (c: HubConnection) => c.on('UserLastSeen', (id: string, when: string) => cb(id, when))
  if (connection) sub(connection); else pendingSubs.push(sub)
}


export type DeliveredPayload = { messageId: string; deliveredAtUtc: string };
export type MessageReadPayload = { messageId: string; readAtUtc: string };

export function onMessageEdited(cb: (p: { messageId: string; encryptedContent: string; updatedAtUtc?: string }) => void) {
  const sub = (c: HubConnection) => c.on('MessageEdited', (p: any) => cb(p));
  if (connection) sub(connection); else pendingSubs.push(sub);
}

export function onMessageDeleted(cb: (p: { messageId: string; scope: 'me'|'all' }) => void) {
  const sub = (c: HubConnection) => c.on('MessageDeleted', (p: any) => cb(p));
  if (connection) sub(connection); else pendingSubs.push(sub);
}


export function onReactionUpdated(cb: (p: { messageId:string; emoji:string; count:number; userId:string; action:'added'|'removed' }) => void) {
  const sub = (c: HubConnection) => c.on('ReactionUpdated', (p:any) => cb(p));
  if (connection) sub(connection); else pendingSubs.push(sub);
}

export async function fetchOnlineUsers(): Promise<string[]> {
  if (!connection) throw new Error('SignalR not connected')
  return await connection.invoke<string[]>('GetOnlineUsers')
}
