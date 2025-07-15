import * as signalR from '@microsoft/signalr'

let connection: signalR.HubConnection | null = null

export function connectToChatHub(token: string): Promise<void> {
  connection = new signalR.HubConnectionBuilder()
    .withUrl('https://localhost:7146/chat', {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .build()

  return connection.start()
}

export function onMessageReceived(callback: (message: any) => void) {
  connection?.on('ReceiveMessage', callback)
}

export function sendMessage(receiverId: string, encryptedText: string) {
  return connection?.invoke('SendMessage', receiverId, encryptedText)
}

export function sendMessageWithFile(
  receiverId: string,
  encryptedText: string,
  fileBase64: string,
  fileName: string
) {
  return connection?.invoke('SendMessageWithFile', {
    receiverId,
    encryptedText,
    fileBase64,
    fileName,
  })
}
