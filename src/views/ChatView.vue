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
  importAESKey
} from '../services/crypto'
import {
  getConversationWith,
  getChatKey,
  getUserById
} from '../services/api'
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

    const chatKeyBase64 = await getChatKey(message.senderId)
    if (!chatKeyBase64) return

    const aesKey = await importAESKey(chatKeyBase64)
    const plainText = await decryptAES(aesKey, message.encryptedText)
    messages.value.push({ ...message, plainText })
  })
})

async function handleUserSelect(user: { id: string; username: string }) {
  selectedUser.value = user
  messages.value = []

  const chatKeyBase64 = await getChatKey(user.id)
  if (!chatKeyBase64) return

  const aesKey = await importAESKey(chatKeyBase64)
  const history = await getConversationWith(user.id)

  for (const msg of history) {
    msg.plainText = await decryptAES(aesKey, msg.encryptedText)
  }

  messages.value = history
}

async function send() {
  if (!selectedUser.value || !text.value) return

  const chatKeyBase64 = await getChatKey(selectedUser.value.id)
  if (!chatKeyBase64) return

  const aesKey = await importAESKey(chatKeyBase64)
  const encrypted = await encryptAES(aesKey, text.value)

  await sendMessage(selectedUser.value.id, encrypted)
  messages.value.push({ senderId: myId, plainText: text.value })
  text.value = ''
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function downloadFile(url: string) {
  window.open(url, '_blank')
}
</script>
