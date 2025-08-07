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
            <div>{{ msg.plainText || '[رمزگشایی نشد]' }}</div>
          </div>
        </div>
      </div>

      <form v-if="selectedUser" @submit.prevent="send" class="p-4 flex gap-2 border-t">
        <input v-model="text" placeholder="پیام..." class="flex-1 border rounded px-3 py-2" />
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
  sendMessage
} from '../services/signalr'
import {
  generateAESKey,
  encryptAES,
  decryptAES,
  exportAESKey,
  importAESKey
} from '../services/crypto'
import {
  getConversationWith,
  getChatKey,
  storeChatKey
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import { parseJwt } from '../utils/jwt'

const router = useRouter()
const token = localStorage.getItem('token') || ''

let myId = ''
try {
  const decoded = parseJwt(token)
  myId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
} catch (err) {
  console.error('❌ JWT decode error:', err)
  router.push('/login')
}

const selectedUser = ref<{ id: string; username: string } | null>(null)
const messages = ref<any[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)

onMounted(async () => {
  if (!token) {
    router.push('/login')
    return
  }

  await connectToChatHub(token)

  onMessageReceived(async (message) => {
    if (!selectedUser.value || message.senderId !== selectedUser.value.id) return

    // اگر فیلد encryptedText نبود، از encryptedContent بگیر
    message.encryptedText = message.encryptedText || message.encryptedContent

    let aesKey = await loadAESKey(message.senderId)
    if (!aesKey) {
      const keyBase64 = await getChatKey(message.senderId)
      if (!keyBase64) return
      aesKey = await importAESKey(keyBase64)
      await saveAESKey(message.senderId, aesKey)
    }

    let decrypted = '[رمزگشایی نشد]'
    if (message.encryptedText && typeof message.encryptedText === 'string') {
      try {
        decrypted = await decryptAES(aesKey, message.encryptedText) || '[رمزگشایی نشد]'
      } catch (e) {
        console.error('❌ رمزگشایی ناموفق:', e)
      }
    }

    messages.value.push({ ...message, plainText: decrypted })
  })
})

async function handleUserSelect(user: { id: string; username: string }) {
  selectedUser.value = user
  messages.value = []

  let aesKey = await loadAESKey(user.id)

  if (!aesKey) {
    const keyBase64 = await getChatKey(user.id)
    if (!keyBase64) {
      console.warn('⛔ کلید چت یافت نشد.')
      return
    }

    aesKey = await importAESKey(keyBase64)
    await saveAESKey(user.id, aesKey)
  }

  const history = await getConversationWith(user.id)

  for (const msg of history) {
    msg.encryptedText = msg.encryptedText || msg.encryptedContent

    if (!msg.encryptedText || typeof msg.encryptedText !== 'string') {
      console.warn('⛔ پیام مشکل‌دار:', msg)
      msg.plainText = '[رمزگشایی نشد]'
      continue
    }

    try {
      msg.plainText = await decryptAES(aesKey, msg.encryptedText) || '[رمزگشایی نشد]'
    } catch (err) {
      console.error('❌ رمزگشایی ناموفق پیام قدیمی:', msg)
      msg.plainText = '[رمزگشایی نشد]'
    }
  }

  messages.value = history
}

async function send() {
  if (!selectedUser.value || !text.value) return

  let keyBase64 = await getChatKey(selectedUser.value.id)
  let aesKey: CryptoKey

  if (!keyBase64) {
    const newKey = await generateAESKey()
    const exported = await exportAESKey(newKey)
    const base64Key = btoa(String.fromCharCode(...exported))

    await storeChatKey({
      receiverId: selectedUser.value.id,
      key: base64Key
    })

    aesKey = newKey
    await saveAESKey(selectedUser.value.id, aesKey)
  } else {
    aesKey = await importAESKey(keyBase64)
    await saveAESKey(selectedUser.value.id, aesKey)
  }

  const encrypted = await encryptAES(aesKey, text.value)
  await sendMessage(selectedUser.value.id, encrypted)
  messages.value.push({ senderId: myId, plainText: text.value })
  text.value = ''
}
</script>
