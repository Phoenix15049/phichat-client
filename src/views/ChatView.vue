<template>
  <div class="flex h-screen">
    <UserList :unread="unread" @user-selected="handleUserSelect" />

    <div class="flex-1 flex flex-col">
        <div class="bg-blue-600 text-white p-4 text-lg">
          <template v-if="selectedUser">
            <router-link
              :to="`/u/${selectedUser.username.replace(/^@/, '')}`"
              class="underline hover:opacity-90"
            >
              @{{ selectedUser.username.replace(/^@/, '') }}
            </router-link>
          </template>
          <template v-else>
            یک مخاطب را انتخاب کنید
          </template>
        </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="msg.senderId === myId ? 'text-right' : 'text-left'"
        >
          <div
            :class="[
              'inline-block px-3 py-2 rounded max-w-[80%]',
              msg.senderId === myId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900',
            ]"
          >
            <!-- متن + تیک وضعیت -->
            <div class="flex items-center gap-2">
              <span>{{ msg.plainText || '' }}</span>
              <span
                v-if="msg.senderId === myId"
                class="text-xs"
                :class="msg.senderId === myId ? 'text-white/80' : 'text-gray-500'"
              >
                <template v-if="msg.status === 'sending'">⌛</template>
                <template v-else-if="msg.status === 'delivered'">✓</template>
                <template v-else-if="msg.status === 'read'">✓✓</template>
              </span>
            </div>

            <!-- لینک فایل -->
            <div v-if="msg.fileUrl" class="mt-1">
              <a
                :href="msg.fileUrl"
                target="_blank"
                :class="[
                  'text-xs',
                  msg.senderId === myId ? 'text-white underline' : 'text-blue-600 underline'
                ]"
              >
                دانلود فایل
              </a>
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
import UserList from '../components/UserList.vue'
import {
  connectToChatHub,
  onMessageReceived,
  sendMessage,
  onDelivered,
  onMessageRead,
  markAsRead
} from '../services/signalr'
import {
  encryptAES,
  decryptAES,
  importAESKey,
  generateAESKey,
  exportAESKey
} from '../services/crypto'
import {
  getConversationWith,
  getChatKey,
  uploadEncryptedFile,
  getUserByUsername,
  storeChatKey
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import { getToken, parseJwt } from '../utils/jwt'
type UiMessage = {
  id?: string
  clientId?: string
  senderId: string
  plainText: string
  fileUrl: string | null
  status?: 'sending' | 'delivered' | 'read'
}
import { useRoute } from 'vue-router'

const route = useRoute()

const EMPTY_MSG_MARKER = '\u200B' // zero-width space

const myId = ref<string>('')
const selectedUser = ref<{ id: string; username: string } | null>(null)
const messages = ref<UiMessage[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)

const unread = ref<Record<string, number>>({})


onMounted(async () => {
  // myId from JWT
  const token = getToken()
  if (token) {
    const payload = parseJwt(token)
    myId.value = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? ''
    await connectToChatHub(token)
    wireSignalR()
  }
  const username = route.params.username as string | undefined
  if (username && !selectedUser.value) {
    try {
      const u = await getUserByUsername(username.replace(/^@/, ''))
      await handleUserSelect({ id: u.id, username: u.username })
    } catch (e) {
      console.error('username not found', e)
    }
  }

})

function wireSignalR() {
  onMessageReceived(async (message: any) => {
    // unify fields
    const isFromOtherPeer = selectedUser.value && message.senderId !== selectedUser.value.id
    const isMyEcho = message.senderId === myId.value

    if (!selectedUser.value || isFromOtherPeer || isMyEcho) {
      if (!isMyEcho) {
        const sid = String(message.senderId)
        unread.value[sid] = (unread.value[sid] ?? 0) + 1
      }
      return
    }
    const raw = (message.encryptedText || message.encryptedContent || '') as string
    const hasCipher = raw.trim().length > 0
    // ensure AES key
    let aesKey = await getOrLoadKey(message.senderId)
    let decrypted = ''
    if (hasCipher) {
      try {
        decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'
      } catch {
        decrypted = '[رمزگشایی نشد]'
      }
    }

    const ui: UiMessage = {
      id: message.messageId,
      senderId: message.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(message.fileUrl || null)
    }
    messages.value.push(ui)

    // mark as read for incoming message
    if (message.messageId) {
      try { await markAsRead(message.messageId) } catch {}
    }
  })

  onDelivered((info: any) => {
    // match by clientId
    const m = messages.value.find(x => x.clientId === info.clientId)
    if (m) {
      m.status = 'delivered'
      m.id = info.messageId
    }
  })

  onMessageRead((info: any) => {
    const m = messages.value.find(x => x.id === info.messageId)
    if (m) m.status = 'read'
  })
}

async function handleUserSelect(user: { id: string; username: string }) {
  selectedUser.value = user
  messages.value = []

  const history = await getConversationWith(user.id)

  // 1) کلید رو یک بار بگیر
  const aesKey = await getOrLoadKey(user.id)

  // 2) رمزگشایی همه پیام‌ها به صورت موازی
  const prepared = await Promise.all(history.map(async (msg: any) => {
    const raw = (msg.encryptedContent || '') as string
    const hasCipher = raw.trim().length > 0

    let decrypted = ''
    if (hasCipher) {
      try {
        decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'
      } catch {
        decrypted = '[رمزگشایی نشد]'
      }
    }

    if (unread.value[user.id]) {
      unread.value[user.id] = 0
    }


    const isMine = msg.senderId === myId.value
    const status: 'delivered' | 'read' | undefined = isMine
      ? (msg.isRead ? 'read' : 'delivered') // اگه isRead داری
      : undefined



    return {
      id: msg.messageId,
      senderId: msg.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
      status
    } as UiMessage
  }))

  // 3) به جای push تکی، یکجا ست کن
  messages.value = prepared

  // 4) markAsRead ها رو موازی و بدون انتظار سراسری بفرست
  const unreadIds: string[] = history
    .filter((m: any) => m.senderId === user.id && (m.isRead === false || m.isRead === undefined))
    .map((m: any) => m.messageId)
    .filter(Boolean)

  // موازی:
  Promise.allSettled(unreadIds.map(id => markAsRead(id))).catch(() => {})
}


function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files && input.files[0] ? input.files[0] : null
}

async function send() {
  if (!selectedUser.value) return

  // ensure AES key
  const aesKey = await getOrLoadKey(selectedUser.value.id)

  // file upload (optional)
  let fileUrl: string | null = null
  if (selectedFile.value) {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const uploadedUrl = await uploadEncryptedFile(fd) // returns absolute url
    fileUrl = toAbsoluteFileUrl(uploadedUrl)
  }

  // message text (or marker)
  const toEncrypt = (text.value && text.value.trim().length > 0) ? text.value : EMPTY_MSG_MARKER
  const encrypted = await encryptAES(aesKey, toEncrypt)

  // optimistic UI add
  const clientId = crypto.randomUUID()
  const mine: UiMessage = {
    clientId,
    senderId: myId.value,
    plainText: (toEncrypt === EMPTY_MSG_MARKER) ? '' : text.value,
    fileUrl: fileUrl,
    status: 'sending'
  }
  messages.value.push(mine)

  // send via SignalR (clientId echoed back in Delivered)
  await sendMessage(selectedUser.value.id, encrypted, fileUrl || undefined, clientId)

  // reset inputs
  text.value = ''
  selectedFile.value = null
}

async function getOrLoadKey(partnerId: string) {
  // 1) try local cache
  let key = await loadAESKey(partnerId)
  if (key) return key

  // 2) try server
  const base64 = await getChatKey(partnerId) // returns string | null
  if (base64) {
    key = await importAESKey(base64)
    await saveAESKey(partnerId, key)
    return key
  }

  // 3) 404 → create new AES key and store on server (both directions)
  const newKey = await generateAESKey()
  const raw = await exportAESKey(newKey) // Uint8Array
  const base64Key = btoa(String.fromCharCode(...raw)) 

  await storeChatKey({
    receiverId: partnerId,
    encryptedKey: base64Key, // plain base64 of AES key (مطابق ساختار فعلی KeysController/Service)
  })

  await saveAESKey(partnerId, newKey)
  return newKey
}

function toAbsoluteFileUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://localhost:7146${url.startsWith('/') ? url : '/' + url}`
}
</script>

<style scoped>
/* minimal */
</style>