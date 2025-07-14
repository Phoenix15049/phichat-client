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

export function sendMessage(receiverId: string, plainText: string) {
  return connection?.invoke('SendMessage', receiverId, plainText)
}

export function sendMessageWithFile(
  receiverId: string,
  plainText: string,
  fileBase64: string,
  fileName: string
) {
  return connection?.invoke('SendMessageWithFile', {
    receiverId,
    plainText,
    fileBase64,
    fileName,
  })
}
