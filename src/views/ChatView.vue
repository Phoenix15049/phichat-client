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
import { getConversationWith } from '../services/api'
import {
  connectToChatHub,
  onMessageReceived,
  sendMessage,
  sendMessageWithFile,
} from '../services/signalr'
import { decryptRSA } from '../services/crypto'
import { parseJwt } from '../utils/jwt'

const router = useRouter()
const token = localStorage.getItem('token') || ''
const privateKey = localStorage.getItem('privateKey') || ''
const decoded = parseJwt(token)
const myId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']

const selectedUser = ref<{ id: string; username: string } | null>(null)
const messages = ref<any[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)

onMounted(async () => {
  if (!token || !privateKey) {
    router.push('/login')
    return
  }

  await connectToChatHub(token)

  onMessageReceived((msg: any) => {
    if (!selectedUser.value) return

    const isRelevant =
      msg.senderId === selectedUser.value.id || msg.receiverId === selectedUser.value.id

    if (!isRelevant) return

    const shouldDecrypt = msg.senderId !== myId
    const plainText = shouldDecrypt
      ? decryptRSA(msg.encryptedContent, privateKey)
      : msg.plainText

    messages.value.push({
      senderId: msg.senderId,
      plainText: plainText || '[خطا در رمزگشایی]',
      fileUrl: msg.fileUrl || null,
    })
  })
})

const handleUserSelect = async (user: { id: string; username: string }) => {
  selectedUser.value = user
  messages.value = []

  const history = await getConversationWith(user.id)

  messages.value = history.map((m: any) => {
    const isOwnMessage = m.senderId === myId

    const plainText = isOwnMessage
      ? m.plainText
      : decryptRSA(m.encryptedContent, privateKey)

    return {
      senderId: m.senderId,
      plainText: plainText || '[خطا در رمزگشایی]',
      fileUrl: m.fileUrl || null,
    }
  })
}

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const send = async () => {
  if (!selectedUser.value || (!text.value.trim() && !selectedFile.value)) return

  if (!selectedFile.value) {
    await sendMessage(selectedUser.value.id, text.value)
  } else {
    const arrayBuffer = await selectedFile.value.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    await sendMessageWithFile(
      selectedUser.value.id,
      text.value,
      base64,
      selectedFile.value.name
    )
  }

  messages.value.push({
    senderId: myId,
    plainText: text.value,
    fileUrl: selectedFile.value ? '[ارسال شد]' : null,
  })

  text.value = ''
  selectedFile.value = null
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
