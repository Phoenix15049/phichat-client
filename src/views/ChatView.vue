<template>
  <div class="flex h-screen">
    <UserList @user-selected="handleUserSelect" />

    <div class="flex-1 flex flex-col">
      <div class="bg-blue-600 text-white p-4 text-lg">
        {{ selectedUser?.username || 'یک مخاطب را انتخاب کنید' }}
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="msg.senderId === myId ? 'text-right' : 'text-left'"
        >
          <div
            :class="[
              'inline-block px-3 py-2 rounded',
              msg.senderId === myId ? 'bg-blue-500 text-white' : 'bg-gray-200',
            ]"
          >
            <div>{{ msg.plainText }}</div>
            <div v-if="msg.fileUrl">
              <button @click="downloadFile(msg.fileUrl)" class="text-sm underline text-blue-300">
                دانلود فایل
              </button>
            </div>
          </div>
        </div>
      </div>

      <form v-if="selectedUser" @submit.prevent="send" class="p-4 flex gap-2 border-t">
        <input v-model="text" placeholder="پیام..." class="flex-1 border rounded px-3 py-2" />
        <input type="file" @change="onFileSelected" />
        <button class="bg-blue-600 text-white px-4 py-2 rounded">ارسال</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import UserList from '../components/UserList.vue'
import {
  connectToChatHub,
  onMessageReceived,
  sendMessage,
  sendMessageWithFile
} from '../services/signalr'
import {
  generateAESKey,
  encryptAES,
  decryptAES,
  encryptWithPublicKey,
  decryptWithPrivateKey
} from '../services/crypto'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import {
  getConversationWith,
  getChatKey,
  storeChatKey,
  getUserById
} from '../services/api'
import { parseJwt } from '../utils/jwt'

const router = useRouter()
const token = localStorage.getItem('token') || ''
const privateKey = localStorage.getItem('privateKey') || ''




let myId = ''
try {
  const decoded = parseJwt(token)
  myId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
} catch (err) {
  console.error('❌ JWT decode error:', err)
  router.push('/login')
}


const selectedUser = ref<{ id: string; username: string; publicKey: string } | null>(null)
const messages = ref<any[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)

onMounted(async () => {
  if (!token || !privateKey) {
    router.push('/login')
    return
  }

  try {
    await connectToChatHub(token)

    onMessageReceived(async (msg: any) => {
      console.log('📩 پیام جدید دریافت شد:', msg)
      const isMyMessage = msg.senderId === myId
      const isFromSelected = selectedUser.value && msg.senderId === selectedUser.value.id
      if (isMyMessage || isFromSelected) {
        await loadMessages()
      }
    })
  } catch (err) {
    console.error('❌ Hub error:', err)
  }
})


const loadMessages = async () => {
  if (!selectedUser.value) return

  try {
    const aesKey = await loadAESKey(selectedUser.value.id)
    if (!aesKey) return
    console.log('📦 imported key:', aesKey)

    const history = await getConversationWith(selectedUser.value.id)
    messages.value = []

    for (const m of history) {
      const plainText = await decryptAES(aesKey, m.encryptedContent)
      messages.value.push({
        senderId: m.senderId,
        plainText: plainText || '[خطا در رمزگشایی]',
        fileUrl: m.fileUrl || null
      })
    }
  } catch (err) {
    console.error('❌ error in loadMessages:', err)
  }
}


const handleUserSelect = async (user: { id: string; username: string; publicKey: string }) => {
  selectedUser.value = user
  messages.value = []

  let aesKey = await loadAESKey(user.id)
  try {
    if (!aesKey) {
      const encrypted = await getChatKey(user.id)
      if (!encrypted) {
        const newKey = await generateAESKey()
        const exported = await crypto.subtle.exportKey('raw', newKey)
        const u = await getUserById(user.id)
        const encryptedKey = await encryptWithPublicKey(u.publicKey, new Uint8Array(exported))
        await storeChatKey({
          receiverId: selectedUser.value.id,
          encryptedKey
        })
        await saveAESKey(user.id, newKey)
        aesKey = newKey
      } else {
        const decrypted = await decryptWithPrivateKey(privateKey, encrypted)
        console.log('🔍 Decrypted AES Key (raw):', decrypted)
        aesKey = await crypto.subtle.importKey('raw', decrypted, 'AES-GCM', true, ['encrypt', 'decrypt'])
        console.log('📦 Imported AES Key:', aesKey)
        await saveAESKey(user.id, aesKey)
      }
    }

  } catch (err) {
  console.error('❌ error in handleUserSelect:', err)
  }
  if (!(aesKey instanceof CryptoKey)) {
    console.error('❌ AES key is invalid, aborting...')
    return
  }


  await loadMessages()
}

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const send = async () => {
  console.log('📤 پیام در حال رمزنگاری:', text.value)

  if (!text.value || !text.value.trim()) {
  console.warn('🚫 پیام خالی یا نامعتبر بود و ارسال نشد')
  return
  }
  if (!selectedUser.value || (!text.value.trim() && !selectedFile.value)) return
  const aesKey = await loadAESKey(selectedUser.value.id)
  if (!aesKey) return
  if (!text.value.trim()) {
  console.warn('❌ پیام خالی ارسال نمی‌شود')
  return
  }
  if (!(aesKey instanceof CryptoKey)) {
    console.error('❌ AES key is invalid')
    return
  }
  const encryptedText = text.value.trim()
    ? await encryptAES(aesKey, text.value.trim())
    : ''

  try {
    if (!selectedFile.value) {
      await sendMessage(selectedUser.value.id, encryptedText)
    } else {
      const arrayBuffer = await selectedFile.value.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      await sendMessageWithFile(
        selectedUser.value.id,
        encryptedText,
        base64,
        selectedFile.value.name
      )
    }

    text.value = ''
    selectedFile.value = null
    console.log('✉️ encryptedText:', encryptedText)

    await loadMessages() // بروزرسانی لیست پیام‌ها
  } catch (error) {
    console.error('❌ خطا در ارسال پیام:', error)
  }
}


const downloadFile = (fileUrl: string) => {
  const link = document.createElement('a')
  link.href = `https://localhost:7146${fileUrl}`
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = 'file'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>
