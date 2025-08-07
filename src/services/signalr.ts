import * as signalR from '@microsoft/signalr'

let connection: signalR.HubConnection

export async function connectToChatHub(token: string) {
  connection = new signalR.HubConnectionBuilder()
    .withUrl('https://localhost:7146/chat', {
      accessTokenFactory: () => token
    })
    .withAutomaticReconnect()
    .build()

  connection.onclose(() => console.warn('🔌 SignalR connection closed'))
  await connection.start()
  console.log('✅ Connected to SignalR')
}

export function onMessageReceived(callback: (message: any) => void) {
  connection.on('ReceiveMessage', callback)
}

export async function sendMessage(receiverId: string, encryptedText: string) {
  await connection.invoke('SendMessage', {
    receiverId,
    encryptedText
  })
}
