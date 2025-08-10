import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr'

let connection: HubConnection

const backendUrl = 'https://localhost:7146/chat'

export async function connectToChatHub(token: string) {
  try {
    connection = new HubConnectionBuilder()
      .withUrl(backendUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build()

    connection.onclose(error => {
      console.error('❌ اتصال SignalR قطع شد:', error)
    })

    connection.onreconnecting(error => {
      console.warn('🔄 در حال تلاش مجدد برای اتصال به SignalR...', error)
    })

    connection.onreconnected(connectionId => {
      console.log('✅ مجدداً متصل شد به SignalR:', connectionId)
    })

    await connection.start()
    console.log('✅ Connected to SignalR at', backendUrl)
  } catch (err) {
    console.error('❌ اتصال SignalR شکست خورد:', err)
  }
}

export function onMessageReceived(callback: (message: any) => void) {
  connection.on('ReceiveMessage', (message) => {
    console.log('📩 پیام دریافتی:', message)
    callback(message)
  })
}

export async function sendMessage(
  receiverId: string,
  encryptedText: string,
  fileUrl?: string
) {
  try {
    await connection.invoke('SendMessage', {
      receiverId,
      encryptedText,
      fileUrl: fileUrl || null
    })
    console.log('📤 پیام ارسال شد به SignalR')
  } catch (err) {
    console.error('❌ خطا در ارسال پیام از طریق SignalR:', err)
  }
}
