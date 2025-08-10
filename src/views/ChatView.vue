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
            <div>{{ msg.plainText || '' }}</div>
            <div v-if="msg.fileUrl">
              <a :href="msg.fileUrl" target="_blank" class="text-xs text-blue-300 underline">دانلود فایل</a>
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
  storeChatKey,
  uploadEncryptedFile
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import { parseJwt } from '../utils/jwt'
const EMPTY_MSG_MARKER = '\u200B'
function toAbsoluteFileUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // force backend origin
  return `https://localhost:7146${url.startsWith('/') ? url : '/' + url}`
}



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
    const raw = (message.encryptedText || message.encryptedContent || '') as string
    const hasText = raw.trim().length > 0

    console.log('📩 پیام دریافتی از SignalR:', message)

    if (!selectedUser.value) {
      console.warn('⚠ پیام دریافت شد ولی هیچ مخاطبی انتخاب نشده:', message)
      return
    }

    if (message.senderId !== selectedUser.value.id) {
      console.warn('⚠ پیام برای کاربر دیگری بود. پیام نادیده گرفته شد:', message)
      return
    }

    message.encryptedText = message.encryptedText || message.encryptedContent;

    let aesKey = await loadAESKey(message.senderId);
    if (!aesKey) {
      const keyBase64 = await getChatKey(message.senderId);
      if (!keyBase64) return;
      aesKey = await importAESKey(keyBase64);
      await saveAESKey(message.senderId, aesKey);
    }

    let decrypted = ''
    if (raw && raw.trim().length > 0) {
      try {
        decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'
      } catch {
        decrypted = '[رمزگشایی نشد]'
      }
    }

    
    if (message.encryptedText && typeof message.encryptedText === 'string') {
      try {
        decrypted = await decryptAES(aesKey, message.encryptedText) || '[رمزگشایی نشد]';
      } catch (e) {
        console.error('❌ رمزگشایی ناموفق:', e);
      }
    }

      messages.value.push({
        senderId: message.senderId,
        plainText: decrypted,
        fileUrl: toAbsoluteFileUrl(message.fileUrl || null),
        hasText
      });
  });

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

    const raw = (msg.encryptedContent || '') as string
    let decrypted = ''
    if (raw.trim().length > 0) {
      try {
        decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'
      } catch {
        decrypted = '[رمزگشایی نشد]'
      }
    }
    const hasText = (decrypted && decrypted !== EMPTY_MSG_MARKER)

    messages.value.push({
      senderId: msg.senderId,
      plainText: hasText ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
      hasText
    })
  }
}

async function send() {
  if (!selectedUser.value || (!text.value && !selectedFile.value)) return

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

  let fileUrl: string | null = null

  if (selectedFile.value) {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    fileUrl = await uploadEncryptedFile(formData)
    selectedFile.value = null
  }

  const toEncrypt = (text.value && text.value.trim().length > 0)
    ? text.value
    : EMPTY_MSG_MARKER // if file-only, send invisible marker
  const encrypted = await encryptAES(aesKey, toEncrypt)

  
  await sendMessage(selectedUser.value.id, encrypted, fileUrl || undefined)
  messages.value.push({ senderId: myId, plainText: text.value, fileUrl })
  text.value = ''
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}
</script>
