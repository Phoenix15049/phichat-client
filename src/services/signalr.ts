// src/services/signalr.ts
import { HubConnectionBuilder, HubConnection, HubConnectionState } from '@microsoft/signalr'

let connection: HubConnection | null = null
let started = false

// queue handlers registered before connection starts
const pendingSubs: Array<(c: HubConnection) => void> = []

function flushPending() {
  if (connection) {
    for (const sub of pendingSubs) sub(connection)
    pendingSubs.length = 0
  }
}

export async function connectToChatHub(token: string) {
  // idempotent connect
  if (connection && (connection.state === HubConnectionState.Connected || started)) {
    return
  }

  connection = new HubConnectionBuilder()
    .withUrl('https://localhost:7146/chat', { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build()

  connection.onclose(err => console.warn('SignalR closed', err))
  connection.onreconnecting(err => console.warn('SignalR reconnecting', err))
  connection.onreconnected(id => console.log('SignalR reconnected', id))

  await connection.start()
  started = true
  console.log('✅ Connected to SignalR')
  flushPending()
}

export function onMessageReceived(cb: (msg: any) => void) {
  const sub = (c: HubConnection) => c.on('ReceiveMessage', cb)
  if (connection) sub(connection); else pendingSubs.push(sub)
}

export function onDelivered(cb: (info: { messageId: string; receiverId: string; sentAt: string }) => void) {
  const sub = (c: HubConnection) => c.on('Delivered', cb)
  if (connection) sub(connection); else pendingSubs.push(sub)
}

export function onMessageRead(cb: (info: { messageId: string; readerId: string }) => void) {
  const sub = (c: HubConnection) => c.on('MessageRead', cb)
  if (connection) sub(connection); else pendingSubs.push(sub)
}

export async function sendMessage(receiverId: string, encryptedText: string, fileUrl?: string, clientId?: string) {
  if (!connection) throw new Error('SignalR not connected')
  await connection.invoke('SendMessage', {
    receiverId,
    encryptedText,
    fileUrl: fileUrl || null,
    clientId: clientId || null       // <- pass through
  })
}


export async function markAsRead(messageId: string) {
  if (!connection) throw new Error('SignalR not connected')
  await connection.invoke('MarkMessageAsRead', messageId)
}
