<template>
  <div class="flex h-screen">
    <div class="w-80 flex flex-col border-r">
      <div class="px-3 py-2 font-semibold text-gray-700 border-b">گفتگوها</div>
      <div class="flex-1 overflow-y-auto">
        <button
          v-for="conv in conversations"
          :key="conv.peerId"
          @click="selectConversation(conv)"
          class="w-full text-right px-3 py-3 border-b hover:bg-gray-50 flex gap-3 items-center"
        >
          <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <span class="text-sm">👤</span>
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <div class="font-medium truncate max-w-[10rem]">
                {{ conv.displayName || '@' + conv.username }}
              </div>
              <div class="text-[11px] text-gray-500 whitespace-nowrap">
                {{ formatRelativeFa(conv.lastSentAt || null) }}
              </div>
            </div>
            <div class="text-xs text-gray-500 flex items-center gap-1">
              <span class="truncate max-w-[12rem]">
                <template v-if="conv.lastFileUrl">[مدیا]</template>
                <template v-else>{{ conv.lastPreview || '' }}</template>
              </span>
              <span
                v-if="conv.unreadCount > 0"
                class="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] min-w-[18px] px-1"
              >
                {{ conv.unreadCount }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>


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

      <!-- typing indicator -->
      <div class="text-xs text-gray-500 h-5 px-4">
        <span v-if="isPeerTyping">در حال تایپ…</span>
      </div>

      <div ref="scrollBox" class="flex-1 overflow-y-auto p-4 space-y-2" @scroll="onScrollLoadMore">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="msg.senderId === myId ? 'text-right' : 'text-left'"
        >

          <div v-if="showDayHeader(index)" class="flex justify-center my-2">
            <span class="text-xs text-gray-500 bg-white/70 rounded-full px-3 py-1 shadow-sm">
              {{ dayLabel(messages[index].sentAt) }}
            </span>
          </div>

          <div
            :class="[
              'inline-block px-3 py-2 rounded max-w-[80%]',
              msg.senderId === myId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900',
            ]":title="tooltipForMessage(msg)"
          >
            <!-- متن -->
          <div class="whitespace-pre-wrap break-words">
            {{ msg.plainText || '' }}
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

          <!-- نوار وضعیت: ساعت کوچک + تیک‌ها -->
          <div
            class="mt-1 flex items-center gap-1 text-[11px]"
            :class="msg.senderId === myId ? 'text-white/80' : 'text-gray-500'"
          >
            <span>{{ fmtHHmmLocal(msg.sentAt) }}</span>
            <span v-if="msg.senderId === myId">
              <template v-if="msg.status === 'read'">✓✓</template>
              <template v-else-if="msg.status === 'delivered'">✓</template>
              <template v-else>…</template>
            </span>
          </div>
          </div>
        </div>
      </div>

      <form v-if="selectedUser" @submit.prevent="send" class="p-4 flex gap-2 border-t">
        <input
          v-model="text"
          @input="onInputChanged"
          @blur="onBlurInput"
          placeholder="پیام..."
          class="flex-1 border rounded px-3 py-2"
        />
        <input type="file" @change="onFileSelected" />
        <button class="bg-blue-600 text-white px-4 py-2 rounded">ارسال</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted,nextTick } from 'vue'
import UserList from '../components/UserList.vue'
import {
  connectToChatHub,
  onMessageReceived,
  sendMessage,
  onDelivered,
  onMessageRead,
  markAsRead,
  // 👇 تایپینگ (طبق سیگنالر کنونی‌ات)
  startTyping,
  stopTyping,
  onTyping,
  onTypingStopped,
  onUserOnline,
  onUserOffline
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
  storeChatKey,
  getConversationPaged,
  getConversations 
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import { getToken, parseJwt } from '../utils/jwt'
import { useRoute } from 'vue-router'
import {toDateSafe, formatAbsoluteFa,formatRelativeFa} from "../utils/time";



type UiMessage = {
  id?: string
  clientId?: string
  senderId: string
  plainText: string
  fileUrl: string | null
  status?: 'sending' | 'delivered' | 'read'
  sentAt?: string
  deliveredAtUtc?: string | null
  readAtUtc?: string | null
}

type UiConversation = {
  peerId: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  unreadCount: number
  lastSentAt?: string | null
  lastFileUrl?: string | null
  lastPreview?: string | null
}







const route = useRoute()
const EMPTY_MSG_MARKER = '\u200B' // zero-width space

const myId = ref<string>('')
const selectedUser = ref<{ id: string; username: string } | null>(null)
const messages = ref<UiMessage[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)
const unread = ref<Record<string, number>>({})
const online = new Set<string>()
const typing = new Set<string>()
// --- typing state (کم‌تغییر) ---
const isPeerTyping = ref(false)
let typingTimer: number | null = null
const TYPING_IDLE_MS = 4000
let prevSelectedUserId: string | null = null



const scrollBox = ref<HTMLElement | null>(null)
const loadingOlder = ref(false)
const hasMore = ref(true)
const oldestId = ref<string | null>(null)



const conversations = ref<UiConversation[]>([])




function fmtHHmmLocal(iso?: string | null): string {
  const d = toDateSafe(iso);
  if (!d) return "";
  return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function tooltipForMessage(msg: any): string {
  const sent = formatAbsoluteFa(msg.sentAt); 
  const delivered = msg.deliveredAtUtc ? formatAbsoluteFa(msg.deliveredAtUtc) : null;
  const read = msg.readAtUtc ? formatAbsoluteFa(msg.readAtUtc) : null;

  if (read) return `ارسال: ${sent}\nخوانده‌شدن: ${read}`;
  if (delivered) return `ارسال: ${sent}\nتحویل: ${delivered}`;
  return `ارسال: ${sent}`;
}



async function selectConversation(conv: UiConversation) {
  // reset unread badge برای این گفتگو (کلاینتی)
  const target = conversations.value.find(c => c.peerId === conv.peerId)
  if (target) target.unreadCount = 0

  await handleUserSelect({ id: conv.peerId, username: conv.username })
}


function dayKey(iso?: string | null): string {
  const d = toDateSafe(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function dayLabel(iso?: string | null): string {
  const d = toDateSafe(iso);
  if (!d) return '';
  // امروز/دیروز
  const today = new Date(); today.setHours(0,0,0,0);
  const that = new Date(d); that.setHours(0,0,0,0);
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 0) return 'امروز';
  if (diffDays === 1) return 'دیروز';
  // نمای کامل محلی
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(d);
}

function showDayHeader(index: number): boolean {
  if (index === 0) return true;
  const a = messages.value[index];
  const b = messages.value[index - 1];
  return dayKey(a.sentAt) !== dayKey(b.sentAt);
}






async function onScrollLoadMore(e: Event) {
  if (!selectedUser.value || !hasMore.value || loadingOlder.value) return;
  const el = scrollBox.value;
  if (!el) return;
  if (el.scrollTop > 80) return; // نزدیک بالا نیست

  loadingOlder.value = true;
  const before = oldestId.value || undefined;

  // ارتفاع قبل از prepend
  const prevHeight = el.scrollHeight;

  try {
    const page = await getConversationPaged(selectedUser.value.id, before, 50);
    const items: any[] = page.items ?? page.Items ?? [];
    hasMore.value = !!(page.hasMore ?? page.HasMore);
    oldestId.value = page.oldestId ?? page.OldestId ?? (items[0]?.messageId || null);

    if (items.length) {
      const aesKey = await getOrLoadKey(selectedUser.value.id);
      const older = await Promise.all(items.map(async (msg: any) => {
        const raw = (msg.encryptedContent || '') as string;
        let decrypted = '';
        if (raw && raw.trim()) {
          try { decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'; }
          catch { decrypted = '[رمزگشایی نشد]'; }
        }
        const isMine = msg.senderId === myId.value;
        const status: 'delivered' | 'read' | undefined = isMine
          ? (msg.isRead ? 'read' : 'delivered')
          : undefined;

        return {
          id: msg.messageId,
          senderId: msg.senderId,
          plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
          fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
          status,
          sentAt: msg.sentAt,
          deliveredAtUtc: msg.deliveredAtUtc || null,
          readAtUtc: msg.readAtUtc || null
        } as UiMessage;
      }));

      // prepend
      messages.value = [...older, ...messages.value];

      await nextTick();
      // نگه‌داشتن موقعیت اسکرول
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeight;
    }
  } finally {
    loadingOlder.value = false;
  }
}


onMounted(async () => {
  // myId from JWT
  const token = getToken()
  if (token) {
    const payload = parseJwt(token)
    myId.value = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? ''
    await connectToChatHub(token)
    wireSignalR()
  }

  try {
      const data = await getConversations()  // آرایه‌ای از کانورسیشن‌ها
      conversations.value = (data || []).map((c: any) => ({
        peerId: c.peerId || c.PeerId,
        username: c.peerUsername || c.PeerUsername || '',
        displayName: c.peerDisplayName || c.PeerDisplayName || null,
        avatarUrl: c.peerAvatarUrl || c.PeerAvatarUrl || null,
        unreadCount: c.unreadCount ?? c.UnreadCount ?? 0,
        lastSentAt: c.lastSentAt || c.LastSentAt || null,
        lastFileUrl: c.lastFileUrl || c.LastFileUrl || null,
        lastPreview: null // در صورت نیاز بعداً با کلید، رمزگشایی و پر می‌کنیم
      }))
      // مرتب به‌صورت نزولی زمان آخرین پیام
      conversations.value.sort((a, b) => {
        const ta = toDateSafe(a.lastSentAt)?.getTime() || 0
        const tb = toDateSafe(b.lastSentAt)?.getTime() || 0
        return tb - ta
      })
    } catch (e) {
      console.warn('load conversations failed', e)
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

  const handleOnline = (userId: string /*, at: string */) => online.add(userId)
  const handleOffline = (userId: string /*, at: string */) => online.delete(userId)

  const handleTyping = (p: { SenderId: string }) => typing.add(p.SenderId)
  const handleTypingStopped = (p: { SenderId: string }) => typing.delete(p.SenderId)

  onUserOnline(handleOnline)
  onUserOffline(handleOffline)
  onTyping(handleTyping)
  onTypingStopped(handleTypingStopped)
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

        // update sidebar conv
        const msgTime = message.sentAt || new Date().toISOString()
        const convIdx = conversations.value.findIndex(c => c.peerId === sid)
        if (convIdx >= 0) {
          const c = conversations.value[convIdx]
          c.unreadCount = (c.unreadCount || 0) + 1
          c.lastSentAt = msgTime
          c.lastFileUrl = message.fileUrl || null
          c.lastPreview = c.lastFileUrl ? null : 'پیام جدید'
          // move to top
          const [moved] = conversations.value.splice(convIdx, 1)
          conversations.value.unshift(moved)
        } else {
          // اگر گفتگو در لیست نبود، یک مورد حداقلی بساز؛ یا می‌تونی از API رفرش کنی
          conversations.value.unshift({
            peerId: sid,
            username: message.senderUsername || ('user_' + sid.substring(0,6)),
            unreadCount: 1,
            lastSentAt: msgTime,
            lastFileUrl: message.fileUrl || null,
            lastPreview: (message.fileUrl ? null : 'پیام جدید'),
          } as UiConversation)
        }
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
      fileUrl: toAbsoluteFileUrl(message.fileUrl || null),
      sentAt: message.sentAt || new Date().toISOString(),
      deliveredAtUtc: message.deliveredAtUtc || null,
      readAtUtc: message.readAtUtc || null
    }
    messages.value.push(ui)
    await nextTick()
    const el = scrollBox.value
    if (el) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      if (nearBottom) el.scrollTop = el.scrollHeight
    }

    // mark as read for incoming message
    if (message.messageId) {
      try { await markAsRead(message.messageId) } catch {}
    }

    
  })
  onDelivered((info: any) => {
    const m = messages.value.find(x => x.clientId === info.clientId)
    if (m) {
      m.status = 'delivered'
      m.id = info.messageId
      if (info.deliveredAtUtc) m.deliveredAtUtc = info.deliveredAtUtc
      if (!m.sentAt) m.sentAt = info.sentAt || new Date().toISOString()
    }
  })

  onMessageRead((info: any) => {
    const m = messages.value.find(x => x.id === info.messageId)
    if (m) {
      m.status = 'read'
      if (info.readAtUtc) m.readAtUtc = info.readAtUtc
    }
  })


  onTyping((p) => {
    const selId = selectedUser.value?.id
    console.log('onTyping payload=', p, 'selectedUser=', selId)
    if (!selId || String(p.SenderId) !== String(selId)) return
    isPeerTyping.value = true
    if (typingTimer) window.clearTimeout(typingTimer)
    typingTimer = window.setTimeout(() => { isPeerTyping.value = false }, TYPING_IDLE_MS)
  })

  onTypingStopped((p) => {
    const selId = selectedUser.value?.id
    console.log('onTypingStopped payload=', p, 'selectedUser=', selId)
    if (!selId || String(p.SenderId) !== String(selId)) return
    isPeerTyping.value = false
    if (typingTimer) { window.clearTimeout(typingTimer); typingTimer = null }
  })
}

async function handleUserSelect(user: { id: string; username: string }) {
  selectedUser.value = user
  messages.value = []
  const idx = conversations.value.findIndex(c => c.peerId === user.id)
  if (idx >= 0) conversations.value[idx].unreadCount = 0
  const page1 = await getConversationPaged(user.id, undefined, 50)
  const history = page1.items ?? page1.Items ?? []
  hasMore.value = !!(page1.hasMore ?? page1.HasMore)
  oldestId.value = page1.oldestId ?? page1.OldestId ?? (history[0]?.messageId || null)

  const aesKey = await getOrLoadKey(user.id)

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
      ? (msg.isRead ? 'read' : 'delivered')
      : undefined


    if (prevSelectedUserId) {
    stopTyping(prevSelectedUserId).catch(() => {})
    }
    prevSelectedUserId = user.id

    selectedUser.value = user
    isPeerTyping.value = false

    return {
      id: msg.messageId,
      senderId: msg.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
      status,
      sentAt: msg.sentAt,
      deliveredAtUtc: msg.deliveredAtUtc || null,
      readAtUtc: msg.readAtUtc || null
    } as UiMessage
  }))

  // 3) یکجا ست کن
  messages.value = prepared
  await nextTick()
  const el = scrollBox.value
  if (el) el.scrollTop = el.scrollHeight


  // 4) markAsRead ها رو موازی و بدون انتظار سراسری بفرست
  const unreadIds: string[] = history
    .filter((m: any) => m.senderId === user.id && (m.isRead === false || m.isRead === undefined))
    .map((m: any) => m.messageId)
    .filter(Boolean)

  Promise.allSettled(unreadIds.map(id => markAsRead(id))).catch(() => {})
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files && input.files[0] ? input.files[0] : null
}

async function send() {
  if (!selectedUser.value) return

  const aesKey = await getOrLoadKey(selectedUser.value.id)

  let fileUrl: string | null = null
  if (selectedFile.value) {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const uploadedUrl = await uploadEncryptedFile(fd) // returns absolute url or /uploads/...
    fileUrl = toAbsoluteFileUrl(uploadedUrl)
  }

  const toEncrypt = (text.value && text.value.trim().length > 0) ? text.value : EMPTY_MSG_MARKER
  const encrypted = await encryptAES(aesKey, toEncrypt)

  const clientId = crypto.randomUUID()
  const mine: UiMessage = {
    clientId,
    senderId: myId.value,
    plainText: (toEncrypt === EMPTY_MSG_MARKER) ? '' : text.value,
    fileUrl: fileUrl,
    status: 'sending',
    sentAt: new Date().toISOString()
  }
  messages.value.push(mine)

  await nextTick();
  const el = scrollBox.value;
  if (el) el.scrollTop = el.scrollHeight;
  
  const uid = selectedUser.value.id
  const convIdx = conversations.value.findIndex(c => c.peerId === uid)
  const nowIso = new Date().toISOString()
  if (convIdx >= 0) {
    const c = conversations.value[convIdx]
    c.lastSentAt = nowIso
    c.lastFileUrl = mine.fileUrl
    c.lastPreview = mine.plainText || (mine.fileUrl ? null : '')
    const [moved] = conversations.value.splice(convIdx, 1)
    conversations.value.unshift(moved)
  } else {
    conversations.value.unshift({
      peerId: uid,
      username: selectedUser.value.username,
      unreadCount: 0,
      lastSentAt: nowIso,
      lastFileUrl: mine.fileUrl,
      lastPreview: mine.plainText || ''
    } as UiConversation)
  }





  await sendMessage(selectedUser.value.id, encrypted, fileUrl || undefined, clientId)
  if (selectedUser.value) stopTyping(selectedUser.value.id).catch(()=>{})
  // reset inputs
  text.value = ''
  selectedFile.value = null


  
  stopTyping(selectedUser.value.id).catch(() => {})
  text.value = ''
  selectedFile.value = null
}


function onInputChanged() {
  if (!selectedUser.value) return
  const now = Date.now()
  const last = (onInputChanged as any)._last || 0
  if (now - last > 900) {
    console.log('➡️ startTyping()', selectedUser.value.id)
    startTyping(selectedUser.value.id).catch(()=>{})
    ;(onInputChanged as any)._last = now
  }
  if (!text.value.trim()) {
    console.log('➡️ stopTyping() (empty text)')
    stopTyping(selectedUser.value.id).catch((e)=>console.warn('stopTyping error', e))
  }
}

function onBlurInput() {
  console.log('➡️ stopTyping() (blur)')
  if (selectedUser.value) stopTyping(selectedUser.value.id).catch(()=>{})
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

  // 3) create & store
  const newKey = await generateAESKey()
  const raw = await exportAESKey(newKey)
  const base64Key = btoa(String.fromCharCode(...raw))
  await storeChatKey({
    receiverId: partnerId,
    encryptedKey: base64Key,
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
</style>
