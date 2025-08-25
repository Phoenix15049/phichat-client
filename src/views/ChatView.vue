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


    <div class="bg-blue-600 text-white p-3">
      <template v-if="selectionMode">
        <div class="flex items-center gap-3">
          <!-- راست: انصراف -->
          <button class="px-2 py-1 rounded hover:bg-white/10" @click="clearSelection">انصراف</button>

          <div class="flex-1"></div>
          <!-- چپ: فوروارد(تعداد) → حذف → کپی متن -->
          <button
            class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1"
            :disabled="!selectedCount"
            @click="openForwardPickerMulti"
            title="فوروارد گروهی"
          >
            فوروارد
            <span class="inline-flex items-center justify-center text-[11px] min-w-[18px] h-[18px] px-1 rounded-full bg-white text-blue-700">
              {{ selectedCount }}
            </span>
          </button>

          <button
            class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50"
            :disabled="!selectedCount"
            @click="openDeleteConfirmMulti"
            title="حذف"
          >حذف</button>

          <button
            class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50"
            :disabled="!selectedCount"
            @click="copySelectedText"
          >کپی متن</button>
        </div>
      </template>
      <template v-else>
        <template v-if="selectedUser">
          <router-link
            :to="`/u/${selectedUser.username.replace(/^@/, '')}`"
            class="underline hover:opacity-90 text-lg"
          >
            @{{ selectedUser.username.replace(/^@/, '') }}
          </router-link>
        </template>
        <template v-else>یک مخاطب را انتخاب کنید</template>
      </template>
    </div>
    



      <div class="text-xs text-gray-500 h-5 px-4">
        <span v-if="isPeerTyping">در حال تایپ…</span>
      </div>

      <div ref="scrollBox" class="flex-1 overflow-y-auto p-4 space-y-2" @scroll="onScrollLoadMore">
        <div v-if="loadingOlder" class="sticky top-2 z-10 flex justify-center">
          <div class="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-1 shadow">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" class="opacity-25"/>
              <path fill="currentColor" class="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <span class="text-xs text-gray-600">در حال بارگذاری…</span>
          </div>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="[
            'relative',
            msg.senderId === myId ? 'text-right' : 'text-left'
          ]"
          @click.stop="onRowClick($event, msg)"                              
          @contextmenu.prevent="!selectionMode && selectedUser ? openMenu($event, msg) : null"
          @mousedown.left="onRowMouseDown($event, msg)"
          @mouseenter="onRowMouseEnter(msg)"   
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
              selectionMode && isSelected(msg) ? 'ring-2 ring-offset-2 ring-blue-400 ring-offset-transparent' : ''
            ]"
            :title="tooltipForMessage(msg)"
            @dblclick="!selectionMode ? (replyingTo = msg) : null"
            @contextmenu.stop.prevent="!selectionMode && selectedUser ? openMenu($event, msg) : null"
            :ref="el => setMessageEl((msg.id || msg.clientId)!, el)"
          >

            <!-- بلوک ریپلای (قابل کلیک برای پرش) -->
            <div
              v-if="msg.replyToMessageId"
              class="mb-1 border-l-2 pl-2 text-xs opacity-80 cursor-pointer hover:underline"
              @click="jumpToReplied(msg.replyToMessageId)"
            >
              <div class="truncate">
                {{ resolveReplyPreview(msg.replyToMessageId) }}
              </div>
            </div>

            <!-- پیام حذف‌شده -->
            <div v-if="msg.isDeleted" class="text-xs text-gray-600 italic">
              پیام حذف شد
            </div>

            <!-- برچسب فروارد -->
            <div
              v-if="msg.forwardedFromSenderId"
              class="mb-1 text-xs opacity-80 border-l-2 pl-2"
            >
              فروارد‌شده از
              <router-link
                v-if="forwardNames[msg.forwardedFromSenderId]"
                :to="`/u/${forwardNames[msg.forwardedFromSenderId].replace(/^@/,'')}`"
                class="font-medium underline hover:opacity-90"
                @mouseenter="cacheForwardName(msg.forwardedFromSenderId)"
              >
                {{ forwardNames[msg.forwardedFromSenderId] }}
              </router-link>
              <span v-else class="font-medium">
                {{ resolveUserName(msg.forwardedFromSenderId) }}
              </span>
            </div>


            <!-- متن -->
            <div class="whitespace-pre-wrap break-words select-text" data-text-selectable>
              {{ msg.plainText || '' }}
            </div>

            <!-- فایل -->
            <div v-if="!msg.isDeleted && msg.fileUrl" class="mt-1">
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

            <!-- زمان + وضعیت + برچسب ویرایش‌شده -->
            <div
              class="mt-1 flex items-center gap-1 text-[11px]"
              :class="msg.senderId === myId ? 'text-white/80' : 'text-gray-500'"
            >
              <span>{{ fmtHHmmLocal(msg.sentAt) }}</span>
              <span v-if="msg.updatedAtUtc" class="ml-1 opacity-80">(ویرایش‌شده)</span>
              <span v-if="msg.senderId === myId">
                <template v-if="msg.status === 'read'">✓✓</template>
                <template v-else-if="msg.status === 'delivered'">✓</template>
                <template v-else>…</template>
              </span>
            </div>
            
                        <!-- Reactions -->
            <div v-if="(msg.reactions && msg.reactions.length) || selectedUser" class="mt-1 flex flex-wrap gap-1">
              <button
                v-for="r in (msg.reactions || [])"
                :key="r.emoji"
                class="text-[11px] px-2 py-[2px] rounded-full border flex items-center gap-1"
                :class="r.mine ? (msg.senderId === myId ? 'bg-white/20 border-white/40' : 'bg-blue-50 border-blue-200') : 'bg-white/80 border-gray-200'"
                @click="toggleReaction(msg, r.emoji)"
                :title="r.count.toString()"
              >
                <span>{{ r.emoji }}</span>
                <span>{{ r.count }}</span>
              </button>

              <!-- Add (+) -->
              <button
                class="text-[11px] px-2 py-[2px] rounded-full border bg-white/80 border-gray-200"
                @click="openReactionPicker(msg)"
                title="واکنش"
              >➕</button>
            </div>

            <!-- Picker ساده‌ی inline -->
            <div v-if="reactionPickerFor && reactionPickerFor === (msg.id || msg.clientId)" class="mt-1 flex gap-1">
              <button v-for="e in quickEmojis" :key="e" class="px-2 py-[2px] text-[13px] rounded hover:bg-gray-100"
                      @click="applyReaction(msg, e)">{{ e }}</button>
              <button class="px-2 py-[2px] text-[11px] text-gray-500" @click="reactionPickerFor = null">بستن</button>
            </div>
            
            <!-- Check indicator (only in selection mode) -->
              <button
                v-if="selectionMode"
                class="absolute top-1"
                :class="msg.senderId === myId ? 'left-1' : 'right-1'"
                @click.stop="toggleSelect(msg)"
                :title="isSelected(msg) ? 'برداشتن از انتخاب' : 'انتخاب پیام'"
              >
                <span
                  :class="[
                    'w-5 h-5 inline-flex items-center justify-center rounded-full border text-[11px]',
                    isSelected(msg)
                      ? (msg.senderId === myId ? 'bg-white text-blue-600 border-white' : 'bg-blue-600 text-white border-blue-600')
                      : 'bg-white/80 text-gray-400 border-gray-300'
                  ]"
                >
                  {{ isSelected(msg) ? '✓' : '' }}
                </span>
              </button>

          </div>

        </div>
      </div>

      <!-- بنر ریپلای -->
      <div v-if="replyingTo" class="px-4 pt-2">
        <div class="px-3 py-2 bg-gray-100 border-l-4 border-blue-500 text-xs flex items-center justify-between rounded">
          <div class="truncate">
            در پاسخ به: {{ resolveReplyPreview(replyingTo.id) }}
          </div>
          <button type="button" class="text-gray-500 hover:text-red-600" @click="replyingTo = null">✕</button>
        </div>
      </div>

      <!-- بنر ویرایش -->
      <div v-if="editingMessage" class="px-4 pt-2">
        <div class="px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 text-xs flex items-center justify-between rounded">
          <div class="truncate">در حال ویرایش پیام</div>
          <button type="button" class="text-gray-500 hover:text-red-600" @click="editingMessage = null">✕</button>
        </div>
      </div>

      <!-- فرم ارسال -->
      <form v-if="selectedUser" @submit.prevent="send" class="p-4 flex gap-2 border-t">
        <input
          v-model="text"
          @input="onInputChanged"
          @blur="onBlurInput"
          placeholder="پیام."
          class="flex-1 border rounded px-3 py-2"
        />
        <input type="file" @change="onFileSelected" />
        <button class="bg-blue-600 text-white px-4 py-2 rounded">ارسال</button>
      </form>

        <!-- منوی راست‌کلیک -->
      <div v-if="contextMenu.visible" class="fixed inset-0 z-40" @click="closeMenu" @contextmenu.prevent="closeMenu">
          <div
            ref="menuEl"                                
            class="absolute z-50 bg-white rounded-lg shadow border min-w-[160px]"
            :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
            @click.stop
          >
            <button class="w-full text-right px-3 py-2 hover:bg-gray-50" @click="startSelectionFrom(contextMenu.msg!)">انتخاب پیام</button>
            <button class="w-full text-right px-3 py-2 hover:bg-gray-50" @click="openForwardPicker">فوروارد…</button>
            <button class="w-full text-right px-3 py-2 hover:bg-gray-50" @click="doReply">پاسخ</button>
            <button v-if="canEdit(contextMenu.msg)" class="w-full text-right px-3 py-2 hover:bg-gray-50" @click="doEdit">ویرایش</button>
            <button
              class="w-full text-right px-3 py-2 hover:bg-gray-50"
              @click="() => { const m = contextMenu.msg; closeMenu(); if (m) openDeleteConfirmSingle(m) }">حذف…</button>

              
          </div>
        </div>
      </div>


      <!-- Forward picker -->
      <div v-if="forwardPicker.visible" class="fixed inset-0 z-40 bg-black/20" @click.self="forwardPicker.visible=false">
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow p-3 w-[320px]">
          <div class="font-medium mb-2">
            {{ forwardPicker.mode === 'multi' ? `ارسال ${forwardPicker.srcList.length} پیام به…` : 'ارسال به…' }}
          </div>
          <div class="max-h-64 overflow-y-auto">
            <button
              v-for="c in conversations"
              :key="c.peerId"
              class="w-full text-right px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
              @click="doForward(c.peerId)"
            >
              {{ c.displayName || '@' + c.username }}
            </button>
          </div>
          <div class="mt-2 text-left">
            <button class="text-xs text-gray-500 hover:text-gray-700" @click="forwardPicker.visible=false">بستن</button>
          </div>
        </div>
      </div>


      <!-- Delete confirm dialog -->
      <div v-if="confirmDel.visible" class="fixed inset-0 z-50 bg-black/30" @click.self="cancelDelete">
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow p-4 w-[360px]">
          <div class="font-medium mb-2">حذف پیام‌ها</div>
          <p class="text-sm text-gray-700 mb-3">
            آیا از حذف {{ confirmDel.count }} پیام مطمئن هستید؟
          </p>

          <label class="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              class="accent-red-600"
              v-model="confirmDel.forAll"
              :disabled="!confirmDel.canAll"
            />
            <span :class="confirmDel.canAll ? '' : 'text-gray-400'">
              حذف برای همه
            </span>
          </label>

          <div class="flex items-center justify-end gap-2">
            <button class="px-3 py-1.5 rounded border" @click="cancelDelete">انصراف</button>
            <button class="px-3 py-1.5 rounded bg-red-600 text-white" @click="confirmDelete">حذف</button>
          </div>
        </div>
      </div>
    </div>
  <!-- Toast -->
  <div
    v-if="toast.show"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white text-sm px-3 py-2 rounded-full shadow"
  >
    {{ toast.text }}
  </div>
</template>



<script setup lang="ts">
import { ref, onMounted,nextTick,onBeforeUnmount,reactive,computed, watch  } from 'vue'

import {
  connectToChatHub,
  onMessageReceived,
  sendMessage,
  onDelivered,
  onMessageRead,
  markAsRead,
  startTyping,
  stopTyping,
  onTyping,
  onTypingStopped,
  onUserOnline,
  onUserOffline,
  onMessageEdited,
  onMessageDeleted,
  onReactionUpdated
} from '../services/signalr'
import {
  encryptAES,
  decryptAES,
  importAESKey,
  generateAESKey,
  exportAESKey
} from '../services/crypto'
import {
  getChatKey,
  uploadEncryptedFile,
  getUserByUsername,
  storeChatKey,
  getConversationPaged,
  getConversations,
  editMessage,
  deleteMessage,
  addReaction, removeReaction,getUserById
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import { getToken, parseJwt } from '../utils/jwt'
import { useRoute } from 'vue-router'
import {toDateSafe, formatAbsoluteFa,formatRelativeFa} from "../utils/time";

type UiReaction = { emoji: string; count: number; mine?: boolean }

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
  replyToMessageId?: string | null
  isDeleted?: boolean
  updatedAtUtc?: string | null
  reactions?: UiReaction[]
  forwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
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

function resolveReplyPreview(id?: string | null): string {
  if (!id) return ''
  const m = messages.value.find((x: any) => x.id === id)
  if (!m) return 'پیام'
  if (m.plainText && m.plainText.trim()) {
    return m.plainText.length > 60 ? m.plainText.slice(0, 60) + '…' : m.plainText
  }
  if (m.fileUrl) return '[مدیا]'
  return 'پیام'
}


const route = useRoute()
const EMPTY_MSG_MARKER = '\u200B' 

const myId = ref<string>('')
const selectedUser = ref<{ id: string; username: string } | null>(null)
const messages = ref<UiMessage[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)
const unread = ref<Record<string, number>>({})
const online = new Set<string>()
const typing = new Set<string>()

const isPeerTyping = ref(false)
let typingTimer: number | null = null
const TYPING_IDLE_MS = 4000
let prevSelectedUserId: string | null = null



const scrollBox = ref<HTMLElement | null>(null)
const loadingOlder = ref(false)
const hasMore = ref(true)
const oldestId = ref<string | null>(null)
const replyingTo = ref<UiMessage | null>(null)

const conversations = ref<UiConversation[]>([])


const msgElMap = new Map<string, HTMLElement>();

const ACTIVE_UID_KEY = 'phi.activeUserId';

const contextMenu = ref<{ visible:boolean, x:number, y:number, msg:UiMessage|null }>({ visible:false, x:0, y:0, msg:null })
const editingMessage = ref<UiMessage | null>(null)

const menuEl = ref<HTMLElement | null>(null)

const quickEmojis = ['👍','❤️','😂','😮','😢','🔥']
const reactionPickerFor = ref<string | null>(null)

const forwardPickerFor = ref<{ msg: UiMessage | null, visible: boolean }>({ msg: null, visible: false })

const forwardNames = reactive<Record<string, string>>({})


const selectionMode = ref(false)
const selected = reactive(new Set<string>())


const toast = reactive({ show: false, text: '' })

const confirmDel = reactive<{
  visible: boolean
  mode: 'single' | 'multi'
  msg: UiMessage | null
  count: number
  canAll: boolean
  forAll: boolean
}>({
  visible: false,
  mode: 'single',
  msg: null,
  count: 0,
  canAll: false,
  forAll: false
})

const isDragSelecting = ref(false)     
const dragPending = ref(false)         
const dragMode = ref<'add' | 'remove'>('add')
const dragVisited = reactive(new Set<string>())
const startClientY = ref(0)
const startClientX = ref(0)
const lastMouseY = ref(0)
let autoScrollTimer: number | null = null
const DRAG_THRESHOLD = 16
const dragStartMsg = ref<UiMessage | null>(null)

const forwardPicker = reactive<{
  visible: boolean
  mode: 'single' | 'multi'
  src: UiMessage | null
  srcList: UiMessage[]
}>({
  visible: false,
  mode: 'single',
  src: null,
  srcList: []
})






function openForwardPickerMulti() { // NEW: from selection header
  if (!selectedCount.value) return
  forwardPicker.visible = true
  forwardPicker.mode = 'multi'
  forwardPicker.src = null
  forwardPicker.srcList = [...selectedMessages.value]
}


function applyDragOn(m: UiMessage) {
  const k = getMsgKey(m)
  if (dragVisited.has(k)) return
  dragVisited.add(k)
  if (dragMode.value === 'add') selected.add(k)
  else selected.delete(k)
}

function onRowMouseDown(ev: MouseEvent, m: UiMessage) {
  // اگر روی متن قابل‌انتخاب کلیک شد → اجازه بده متن انتخاب شود
  if (isInTextSelectable(ev.target)) return
  if (!selectedUser.value) return
  if (ev.button !== 0) return

  ev.preventDefault()
  ev.stopPropagation()

  // حالت درگ در انتظار عبور از آستانه
  const k = getMsgKey(m)
  const already = selected.has(k)
  dragMode.value = already ? 'remove' : 'add'

  dragStartMsg.value = m
  dragPending.value = true
  isDragSelecting.value = false
  dragVisited.clear()
  startClientY.value = ev.clientY
  startClientX.value = ev.clientX
  lastMouseY.value = ev.clientY

  window.addEventListener('mouseup', endDragSelect)
  window.addEventListener('mousemove', onDragMouseMove, { passive: true })
}


function onDragMouseMove(ev: MouseEvent) {
  lastMouseY.value = ev.clientY

  if (dragPending.value && !isDragSelecting.value) {
    const dy = Math.abs(ev.clientY - startClientY.value)
    const dx = Math.abs(ev.clientX - startClientX.value)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      // عبور از آستانه → شروع انتخاب
      if (!selectionMode.value) selectionMode.value = true
      isDragSelecting.value = true
      dragPending.value = false
      startAutoScroll()

      // ✅ مهم: پیام شروع‌کننده را همین حالا اعمال کن
      if (dragStartMsg.value) applyDragOn(dragStartMsg.value)
    }
  }
  // انتخاب روی mouseenter انجام می‌شود
}

function onRowMouseEnter(m: UiMessage) {
  if (!isDragSelecting.value) return
  applyDragOn(m)
}

function endDragSelect() {
  stopAutoScroll()
  dragPending.value = false
  isDragSelecting.value = false
  dragVisited.clear()
  window.removeEventListener('mouseup', endDragSelect)
  window.removeEventListener('mousemove', onDragMouseMove)
}

function startAutoScroll() {
  const el = scrollBox.value as HTMLElement | null
  if (!el) return
  stopAutoScroll()
  autoScrollTimer = window.setInterval(() => {
    if (!isDragSelecting.value) return
    const rect = el.getBoundingClientRect()
    const margin = 32
    const speed = 12
    if (lastMouseY.value < rect.top + margin) el.scrollTop -= speed
    else if (lastMouseY.value > rect.bottom - margin) el.scrollTop += speed
  }, 30)
}
function stopAutoScroll() {
  if (autoScrollTimer) { clearInterval(autoScrollTimer); autoScrollTimer = null }
}


function onRowClick(ev: MouseEvent, m: UiMessage) {
  if (isInTextSelectable(ev.target)) return

  if (selectionMode.value) {
    toggleSelect(m)
  }
}

function isInTextSelectable(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return !!el.closest('[data-text-selectable]')
}


function openDeleteConfirmSingle(msg: UiMessage, scopeDefault?: 'me'|'all') {
  confirmDel.visible = true
  confirmDel.mode = 'single'
  confirmDel.msg = msg
  confirmDel.count = 1
  confirmDel.canAll = isMine(msg)
  confirmDel.forAll = scopeDefault === 'all' && confirmDel.canAll
}

function openDeleteConfirmMulti() {
  confirmDel.visible = true
  confirmDel.mode = 'multi'
  confirmDel.msg = null
  confirmDel.count = selectedCount.value
  confirmDel.canAll = allSelectedAreMine.value
  confirmDel.forAll = false
}

function cancelDelete() {
  confirmDel.visible = false
}

async function confirmDelete() {
  try {
    if (confirmDel.mode === 'single' && confirmDel.msg?.id) {
      const scope = (confirmDel.forAll && confirmDel.canAll) ? 'all' : 'me'
      await deleteMessage(confirmDel.msg.id, scope)
      const i = messages.value.findIndex(x => x.id === confirmDel.msg!.id)
      if (i >= 0) messages.value.splice(i, 1)
    } else if (confirmDel.mode === 'multi') {
      const scope = (confirmDel.forAll && confirmDel.canAll) ? 'all' : 'me'
      const ids = selectedMessages.value.map(m => m.id!).filter(Boolean)
      await Promise.all(ids.map(id => deleteMessage(id, scope).catch(()=>{})))
      for (const id of ids) {
        const i = messages.value.findIndex(x => x.id === id)
        if (i >= 0) messages.value.splice(i, 1)
      }
      clearSelection()
    }
    showToast('حذف شد')
  } catch (e) {
    console.warn('confirmDelete failed', e)
  } finally {
    confirmDel.visible = false
  }
}

function showToast(t: string) {
  toast.text = t
  toast.show = true
  setTimeout(() => { toast.show = false }, 1400)
}


type UiMsgKey = string
function getMsgKey(m: UiMessage): UiMsgKey { return (m.id || m.clientId)! }
function isSelected(m: UiMessage) { return selected.has(getMsgKey(m)) }
function toggleSelect(m: UiMessage) {
  const k = getMsgKey(m)
  if (selected.has(k)) selected.delete(k); else selected.add(k)
}
function clearSelection() { selected.clear(); selectionMode.value = false }

const selectedMessages = computed(() => messages.value.filter(m => selected.has(getMsgKey(m))))
const selectedCount = computed(() => selected.size)
const allSelectedAreMine = computed(() => selectedMessages.value.length > 0 && selectedMessages.value.every(m => m.senderId === myId.value))

watch(selectedUser, () => clearSelection())

watch(selectedCount, (n) => {
  if (n === 0 && selectionMode.value) {
    selectionMode.value = false
  }
})


function onKeydownSelection(e: KeyboardEvent) {
  if (e.key === 'Escape' && selectionMode.value) clearSelection()
}
onMounted(() => window.addEventListener('keydown', onKeydownSelection))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydownSelection))

async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {}
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch {}
  document.body.removeChild(ta)
}

async function copySelectedText() {
  if (!selectedCount.value) return
  const ordered = [...selectedMessages.value].sort((a,b) => (a.sentAt||'').localeCompare(b.sentAt||''))
  const lines = ordered.map(m => (m.plainText || '').trim()).filter(Boolean)
  if (lines.length === 0) return
  await writeClipboard(lines.join('\n'))
  clearSelection()
  showToast('متن کپی شد')
}


// Extract URLs from text
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/\S*)?)/g
function extractUrls(s: string): string[] {
  return (s.match(URL_RE) || []).map(u => u.startsWith('www.') ? `https://${u}` : u)
}

async function copySelectedLinks() {
  if (!selectedCount.value) return
  const urls: string[] = []
  for (const m of selectedMessages.value) {
    if (m.plainText) urls.push(...extractUrls(m.plainText))
    if (m.fileUrl) urls.push(m.fileUrl)
  }
  const uniq = Array.from(new Set(urls))
  if (uniq.length === 0) return
  await writeClipboard(uniq.join('\n'))
}

async function deleteSelectedForMe() {
  if (!selectedCount.value) return
  openDeleteConfirmMulti()
}

function startSelectionFrom(m: UiMessage) {
  selectionMode.value = true
  selected.clear()
  toggleSelect(m)
  closeMenu()
}


function cacheForwardName(id?: string | null) {
  if (!id || forwardNames[id]) return

  const conv = conversations.value.find(c => c.peerId === id)
  if (conv) {
    forwardNames[id] = conv.displayName || '@' + conv.username
    return
  }

  getUserById(id)
    .then(u => { if (u) forwardNames[id] = (u.displayName || '@' + u.username) })
    .catch(() => {})
}


function openForwardPicker() { // single from context menu
  if (!contextMenu.value.msg) return
  forwardPicker.visible = true
  forwardPicker.mode = 'single'
  forwardPicker.src = contextMenu.value.msg
  forwardPicker.srcList = []
  closeMenu()
}

async function doForward(toPeerId: string) {
  const mode = forwardPicker.mode
  const srcSingle = forwardPicker.src
  const srcList  = forwardPicker.srcList
  forwardPicker.visible = false

  try {
    const aesKey = await getOrLoadKey(toPeerId)
    const sameChat = selectedUser.value && selectedUser.value.id === toPeerId

    if (mode === 'single' && srcSingle) {
      const src = srcSingle
      const cipher = await encryptAES(aesKey, src.plainText || '')
      const clientId = sameChat ? crypto.randomUUID() : null

      // optimistic برای همان چت
      if (sameChat) {
        const mine: UiMessage = {
          clientId: clientId || undefined,
          senderId: myId.value,
          plainText: src.plainText,
          fileUrl: src.fileUrl || null,
          status: 'sending',
          sentAt: new Date().toISOString(),
          forwardedFromMessageId: src.forwardedFromMessageId || src.id || null,
          forwardedFromSenderId:  src.forwardedFromSenderId  || src.senderId || null,
        }
        messages.value.push(mine)
        await nextTick()
        const el = scrollBox.value
        if (el) el.scrollTop = el.scrollHeight
        if (mine.forwardedFromSenderId) cacheForwardName(mine.forwardedFromSenderId)
      }

      await sendMessage(
        toPeerId,
        cipher,
        src.fileUrl || null,
        clientId,
        null,
        src.forwardedFromMessageId || src.id || null
      )

      // آپدیت سایدبار مقصد (خلاصه)
      if (!sameChat) {
        const nowIso = new Date().toISOString()
        const idx = conversations.value.findIndex(c => c.peerId === toPeerId)
        if (idx >= 0) {
          const c = conversations.value[idx]
          c.lastSentAt = nowIso
          c.lastFileUrl = src.fileUrl || null
          c.lastPreview = src.plainText || (src.fileUrl ? null : '')
          const [moved] = conversations.value.splice(idx, 1)
          conversations.value.unshift(moved)
        }
      }
    } else if (mode === 'multi' && srcList.length) {
      // ترتیب زمان (قدیمی → جدید) مثل تلگرام
      const list = [...srcList].sort((a,b) => (a.sentAt||'').localeCompare(b.sentAt||''))

      // optimistic: اگر مقصد همین چت است، همه را اضافه کنیم
      const clientMap = new Map<string, string>() // srcKey -> clientId
      if (sameChat) {
        for (const src of list) {
          const clientId = crypto.randomUUID()
          clientMap.set((src.id || src.clientId)!, clientId)
          const mine: UiMessage = {
            clientId,
            senderId: myId.value,
            plainText: src.plainText,
            fileUrl: src.fileUrl || null,
            status: 'sending',
            sentAt: new Date().toISOString(),
            forwardedFromMessageId: src.forwardedFromMessageId || src.id || null,
            forwardedFromSenderId:  src.forwardedFromSenderId  || src.senderId || null,
          }
          messages.value.push(mine)
          if (mine.forwardedFromSenderId) cacheForwardName(mine.forwardedFromSenderId)
        }
        await nextTick()
        const el = scrollBox.value
        if (el) el.scrollTop = el.scrollHeight
      }

      // ارسال ترتیبی
      for (const src of list) {
        const cipher = await encryptAES(aesKey, src.plainText || '')
        const srcKey = (src.id || src.clientId)!
        const clientId = sameChat ? clientMap.get(srcKey) || null : null

        await sendMessage(
          toPeerId,
          cipher,
          src.fileUrl || null,
          clientId,
          null,
          src.forwardedFromMessageId || src.id || null
        )
      }

      // خروج از حالت انتخاب و اعلان
      clearSelection()
      showToast('ارسال شد')
      // سایدبار مقصد (خلاصه)
      if (!sameChat) {
        const last = list[list.length - 1]
        const nowIso = new Date().toISOString()
        const idx = conversations.value.findIndex(c => c.peerId === toPeerId)
        if (idx >= 0) {
          const c = conversations.value[idx]
          c.lastSentAt = nowIso
          c.lastFileUrl = last.fileUrl || null
          c.lastPreview = last.plainText || (last.fileUrl ? null : '')
          const [moved] = conversations.value.splice(idx, 1)
          conversations.value.unshift(moved)
        }
      }
    }
  } catch (e) {
    console.warn('forward failed', e)
  }
}


function resolveUserName(userId?: string | null) {
  if (!userId) return 'کاربر'
  const conv = conversations.value.find(c => c.peerId === userId)
  if (conv) return conv.displayName || '@' + conv.username
  return 'کاربر'
}


function draftKey(peerId: string) {
  const uid = myId.value || 'me'
  return `phi.draft.${uid}.${peerId}`
}
function loadDraft(peerId: string): string {
  try { return localStorage.getItem(draftKey(peerId)) || '' } catch { return '' }
}
function saveDraft(peerId: string, text: string) {
  try { localStorage.setItem(draftKey(peerId), text) } catch {}
}
function clearDraft(peerId: string) {
  try { localStorage.removeItem(draftKey(peerId)) } catch {}
}

function openReactionPicker(m: UiMessage) {
  reactionPickerFor.value = m.id || m.clientId || null
}

async function applyReaction(m: UiMessage, emoji: string) {
  reactionPickerFor.value = null
  await toggleReaction(m, emoji)
}
async function toggleReaction(m: UiMessage, emoji: string) {
  if (!m.id) return;
  const list = m.reactions || (m.reactions = []);
  m.reactions = dedupeReactions(list);

  const cur = m.reactions.find(r => r.emoji === emoji);

  if (cur?.mine) {
    cur.mine = false;
    cur.count = Math.max(0, cur.count - 1);
    if (cur.count === 0) m.reactions = m.reactions.filter(r => r !== cur);
    try { await removeReaction(m.id, emoji); } catch { /* می‌تونی rollback کنی */ }
  } else {
    if (cur) { cur.mine = true; cur.count += 1; }
    else m.reactions.push({ emoji, count: 1, mine: true });
    m.reactions = dedupeReactions(m.reactions);
    try { await addReaction(m.id, emoji); } catch { /* rollback در صورت نیاز */ }
  }
}


function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}
function onWindowScroll() {
  closeMenu()
}
function onWindowResize() {
  if (contextMenu.value.visible) nextTick(() => clampMenuPosition())
}

function clampMenuPosition() {
  const el = menuEl.value
  if (!el) return
  const pad = 8
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const rect = el.getBoundingClientRect()

  let x = contextMenu.value.x
  let y = contextMenu.value.y

  if (x + rect.width + pad > vpW) x = Math.max(pad, vpW - rect.width - pad)
  else x = Math.max(pad, x)

  if (y + rect.height + pad > vpH) y = Math.max(pad, vpH - rect.height - pad)
  else y = Math.max(pad, y)

  contextMenu.value.x = x
  contextMenu.value.y = y
}





function openMenu(e: MouseEvent, m: UiMessage) {
  if (contextMenu.value.visible) {
    closeMenu()
    return
  }
  contextMenu.value.msg = m
  contextMenu.value.visible = true
  contextMenu.value.x = e.clientX
  contextMenu.value.y = e.clientY
  nextTick(() => clampMenuPosition())
}


function closeMenu() {
  contextMenu.value.visible = false
  contextMenu.value.msg = null
}
function doReply() {
  if (contextMenu.value.msg) replyingTo.value = contextMenu.value.msg
  closeMenu()
}
function doEdit() {
  if (!contextMenu.value.msg) return
  editingMessage.value = contextMenu.value.msg
  text.value = editingMessage.value.plainText
  closeMenu()
}
// async function doDeleteMe() {
//   const m = contextMenu.value.msg; closeMenu(); if (!m?.id) return
//   openDeleteConfirmSingle(m, 'me')
// }
// async function doDeleteAll() {
//   const m = contextMenu.value.msg; closeMenu(); if (!m?.id) return
//   openDeleteConfirmSingle(m, 'all')
// }



function isMine(m?: UiMessage|null) { return !!m && m.senderId === myId.value }
function canEdit(m?: UiMessage|null) { return isMine(m) && !m?.fileUrl && !m?.isDeleted }


function loadAESKeyScoped(partnerId: string) {
  try {
    const uid = localStorage.getItem(ACTIVE_UID_KEY);
    if (!uid || uid !== myId.value) return null;
  } catch {}
  return loadAESKey(partnerId); 
}

async function saveAESKeyScoped(partnerId: string, key: CryptoKey) {
  try { localStorage.setItem(ACTIVE_UID_KEY, myId.value); } catch {}
  return await saveAESKey(partnerId, key);
}



async function jumpToReplied(targetId?: string | null) {
  if (!targetId || !selectedUser.value) return;
  await jumpToMessage(targetId);
}

async function jumpToMessage(targetId: string) {

  let el = msgElMap.get(targetId);
  if (!el) {

    let tries = 0;
    while (!el && hasMore.value && tries < 10) {
      const loaded = await loadOlderOnce();
      if (!loaded) break;
      await nextTick();
      el = msgElMap.get(targetId);
      tries++;
    }
  }
  if (el && scrollBox.value) {
    
    const container = scrollBox.value;
    const top = el.offsetTop - 100;
    container.scrollTo({ top, behavior: "smooth" });


    el.classList.add("ring-2", "ring-yellow-400", "ring-offset-2", "ring-offset-transparent");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-yellow-400", "ring-offset-2", "ring-offset-transparent");
    }, 1200);
  }
}


async function loadOlderOnce(): Promise<boolean> {
  if (!selectedUser.value || !hasMore.value || loadingOlder.value) return false;
  const el = scrollBox.value;
  const prevHeight = el?.scrollHeight ?? 0;
  
  loadingOlder.value = true;
  try {
    const page = await getConversationPaged(selectedUser.value.id, oldestId.value || undefined, 50);
    const items: any[] = (page.items ?? page.Items ?? []).filter(m => !m.isDeleted)
    hasMore.value = !!(page.hasMore ?? page.HasMore);
    oldestId.value = page.oldestId ?? page.OldestId ?? (items[0]?.messageId || null);

    if (!items.length) return false;
    
    const aesKey = await getOrLoadKey(selectedUser.value.id);
    const older = await Promise.all(items.map(async (msg: any) => {
      const raw = (msg.encryptedContent || "") as string;
      let decrypted = "";
      if (raw && raw.trim()) {
        try { decrypted = (await decryptAES(aesKey, raw)) || "[رمزگشایی نشد]"; }
        catch { decrypted = "[رمزگشایی نشد]"; }
      }
      
      
      const srvReacts = msg.reactions || msg.Reactions || []
      let reactions: UiReaction[] = srvReacts.map((r:any) => ({
        emoji: r.emoji || r.Emoji,
        count: r.count ?? r.Count ?? 0,
        mine: !!(r.mine ?? r.Mine)
      }))
      reactions = dedupeReactions(reactions);

      const isMine = msg.senderId === myId.value;
      const status: "delivered" | "read" | undefined = isMine
        ? (msg.isRead ? "read" : "delivered")
        : undefined;

      const fwdFrom = msg.forwardedFromSenderId || msg.ForwardedFromSenderId
      if (fwdFrom) cacheForwardName(fwdFrom)


      return {
        id: msg.messageId,
        senderId: msg.senderId,
        plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : "",
        fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
        status,
        sentAt: msg.sentAt,
        deliveredAtUtc: msg.deliveredAtUtc || null,
        readAtUtc: msg.readAtUtc || null,
        replyToMessageId: msg.replyToMessageId || null,
        isDeleted: !!msg.isDeleted,
        updatedAtUtc: msg.updatedAtUtc || null,
        reactions,
        forwardedFromMessageId: msg.forwardedFromMessageId || msg.ForwardedFromMessageId || null,
        forwardedFromSenderId:  msg.forwardedFromSenderId  || msg.ForwardedFromSenderId  || null,
      } as UiMessage;
    }));

    messages.value = [...older, ...messages.value];

    await nextTick();
    if (el) {
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeight + el.scrollTop;
    }
    return true;
  } finally {
    loadingOlder.value = false;
  }
}



function dedupeReactions(list: {emoji:string; count:number; mine?:boolean}[]) {
  const map = new Map<string, {emoji:string; count:number; mine?:boolean}>();
  for (const r of list) {
    const key = r.emoji;
    const ex = map.get(key);
    if (!ex) map.set(key, { ...r });
    else {
      ex.count = r.count;                  
      ex.mine = ex.mine || r.mine || false;
    }
  }
  return Array.from(map.values()).filter(r => r.count > 0);
}





function setMessageEl(id?: string, el?: Element | null) {
  if (!id) return;
  if (el) msgElMap.set(id, el as HTMLElement);
  else msgElMap.delete(id);
}

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

  const today = new Date(); today.setHours(0,0,0,0);
  const that = new Date(d); that.setHours(0,0,0,0);
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 0) return 'امروز';
  if (diffDays === 1) return 'دیروز';

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
  if (el.scrollTop > 80) return;

  loadingOlder.value = true;
  const before = oldestId.value || undefined;

  const prevHeight = el.scrollHeight;

  try {
    const page = await getConversationPaged(selectedUser.value.id, before, 50);
    const items: any[] = (page.items ?? page.Items ?? []).filter(m => !m.isDeleted)
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

        const srvReacts = msg.reactions || msg.Reactions || []
        let reactions: UiReaction[] = srvReacts.map((r:any) => ({
          emoji: r.emoji || r.Emoji,
          count: r.count ?? r.Count ?? 0,
          mine: !!(r.mine ?? r.Mine)
        }))
        reactions = dedupeReactions(reactions);
        const isMine = msg.senderId === myId.value;
        const status: 'delivered' | 'read' | undefined = isMine
          ? (msg.isRead ? 'read' : 'delivered')
          : undefined;

        
        const fwdFrom = msg.forwardedFromSenderId || msg.ForwardedFromSenderId
        if (fwdFrom) cacheForwardName(fwdFrom)


        return {
          id: msg.messageId,
          senderId: msg.senderId,
          plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
          fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
          status,
          sentAt: msg.sentAt,
          deliveredAtUtc: msg.deliveredAtUtc || null,
          readAtUtc: msg.readAtUtc || null,
          replyToMessageId: msg.replyToMessageId || msg.ReplyToMessageId || null,
          isDeleted: !!msg.isDeleted,
          updatedAtUtc: msg.updatedAtUtc || null,
          reactions,
          forwardedFromMessageId: msg.forwardedFromMessageId || msg.ForwardedFromMessageId || null,
          forwardedFromSenderId:  msg.forwardedFromSenderId  || msg.ForwardedFromSenderId  || null,


        } as UiMessage;
      }));

      messages.value = [...older, ...messages.value];

      await nextTick();
      
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeight;
    }
  } finally {
    loadingOlder.value = false;
  }
}


onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', onWindowResize)
  stopAutoScroll()
  window.removeEventListener('mouseup', endDragSelect)
  window.removeEventListener('mousemove', onDragMouseMove)
})


onMounted(async () => {
  // myId from JWT
  const token = getToken()
  if (token) {
    const payload = parseJwt(token)
    myId.value = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? ''
    try { localStorage.setItem(ACTIVE_UID_KEY, myId.value); } catch {}
    await connectToChatHub(token)
    wireSignalR()
  }

  try {
      const data = await getConversations() 
      conversations.value = (data || []).map((c: any) => ({
        peerId: c.peerId || c.PeerId,
        username: c.peerUsername || c.PeerUsername || '',
        displayName: c.peerDisplayName || c.PeerDisplayName || null,
        avatarUrl: c.peerAvatarUrl || c.PeerAvatarUrl || null,
        unreadCount: c.unreadCount ?? c.UnreadCount ?? 0,
        lastSentAt: c.lastSentAt || c.LastSentAt || null,
        lastFileUrl: c.lastFileUrl || c.LastFileUrl || null,
        lastPreview: null 
      }))

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

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onWindowScroll, true) 
  window.addEventListener('resize', onWindowResize)


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
    let decrypted = await decryptAES(aesKey, raw);

    if (!decrypted) {
      const retryKey = await getOrLoadKey(message.senderId);
      if (retryKey !== aesKey) {
        decrypted = await decryptAES(retryKey, raw);
      }
    }

    const ui: UiMessage = {
      id: message.messageId,
      senderId: message.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(message.fileUrl || null),
      sentAt: message.sentAt || new Date().toISOString(),
      deliveredAtUtc: message.deliveredAtUtc || null,
      readAtUtc: message.readAtUtc || null,
      replyToMessageId: message.replyToMessageId || message.ReplyToMessageId || null,
      forwardedFromMessageId: message.forwardedFromMessageId || message.ForwardedFromMessageId || null,
      forwardedFromSenderId:  message.forwardedFromSenderId  || message.ForwardedFromSenderId  || null,
      
    }
    if (ui.forwardedFromSenderId) cacheForwardName(ui.forwardedFromSenderId)
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

  onMessageEdited(async (p) => {
    const m = messages.value.find(x => x.id === p.messageId)
    if (!m) return
    try {
      const partnerId = selectedUser.value?.id || m.senderId
      const aesKey = await getOrLoadKey(partnerId)
      const decrypted = await decryptAES(aesKey, p.encryptedContent)
      m.plainText = decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : ''
      m.updatedAtUtc = p.updatedAtUtc || new Date().toISOString()
    } catch (e) {
      console.warn('decrypt edited failed', e)
    }
  })

  onMessageDeleted((p) => {
    const i = messages.value.findIndex(x => x.id === p.messageId)
    if (i < 0) return
    // if (p.scope === 'all') {
    //   const m = messages.value[i]
    //   m.isDeleted = true
    //   m.plainText = ''
    //   m.fileUrl = null
    //   m.updatedAtUtc = new Date().toISOString()
    // } else {
    //   messages.value.splice(i, 1)
    // }
    messages.value.splice(i, 1)
})

onReactionUpdated((p) => {
  const m = messages.value.find(x => x.id === p.messageId);
  if (!m) return;

  const list = m.reactions || (m.reactions = []);

  const idxs = list.map((r, i) => r.emoji === p.emoji ? i : -1).filter(i => i >= 0);

  if (idxs.length === 0) {
    list.push({ emoji: p.emoji, count: p.count, mine: p.userId === myId.value && p.action === 'added' });
  } else {

    const first = list[idxs[0]];
    first.count = p.count;
    if (p.userId === myId.value) first.mine = (p.action === 'added');
    for (let k = idxs.length - 1; k >= 1; k--) list.splice(idxs[k], 1);
  }

  m.reactions = dedupeReactions(list);
});








}

async function handleUserSelect(user: { id: string; username: string }) {
  selectedUser.value = user
  messages.value = []
  text.value = loadDraft(user.id)
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


    const srvReacts = msg.reactions || msg.Reactions || []
    let reactions: UiReaction[] = srvReacts.map((r:any) => ({
      emoji: r.emoji || r.Emoji,
      count: r.count ?? r.Count ?? 0,
      mine: !!(r.mine ?? r.Mine)
    }))
    reactions = dedupeReactions(reactions);

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
    const fwdFrom = msg.forwardedFromSenderId || msg.ForwardedFromSenderId
    if (fwdFrom) cacheForwardName(fwdFrom)

    return {
      id: msg.messageId,
      senderId: msg.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
      status,
      sentAt: msg.sentAt,
      deliveredAtUtc: msg.deliveredAtUtc || null,
      readAtUtc: msg.readAtUtc || null,
      replyToMessageId: msg.replyToMessageId || null,
      isDeleted: !!msg.isDeleted,
      updatedAtUtc: msg.updatedAtUtc || null,
      reactions,
      forwardedFromMessageId: msg.forwardedFromMessageId || msg.ForwardedFromMessageId || null,
      forwardedFromSenderId:  msg.forwardedFromSenderId  || msg.ForwardedFromSenderId  || null,


    } as UiMessage
  }))


  messages.value = prepared
  await nextTick()
  const el = scrollBox.value
  if (el) el.scrollTop = el.scrollHeight


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
    const uploadedUrl = await uploadEncryptedFile(fd)
    fileUrl = toAbsoluteFileUrl(uploadedUrl)
  }



  // edit-mode
  if (editingMessage.value && editingMessage.value.id) {
    const aesKey = await getOrLoadKey(selectedUser.value.id)
    const encrypted = await encryptAES(aesKey, text.value.trim() || EMPTY_MSG_MARKER)
    try {
      await editMessage(editingMessage.value.id, encrypted)
      editingMessage.value.plainText = text.value.trim()
      editingMessage.value.updatedAtUtc = new Date().toISOString()
      editingMessage.value = null
      text.value = ''
      
    } catch(e) {
      console.warn('edit failed', e)
    }
    return
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
    sentAt: new Date().toISOString(),
    replyToMessageId: replyingTo.value?.id || null,

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





  await sendMessage(
    selectedUser.value.id,
    encrypted,
    fileUrl || null,
    clientId,
    replyingTo.value?.id ?? null 
  )
  replyingTo.value = null

  if (selectedUser.value) clearDraft(selectedUser.value.id)

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
  if (selectedUser.value) saveDraft(selectedUser.value.id, text.value)
}

function onBlurInput() {
  console.log('➡️ stopTyping() (blur)')
  if (selectedUser.value) stopTyping(selectedUser.value.id).catch(()=>{})
}


function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }


async function getOrLoadKey(partnerId: string) {

  let key = await loadAESKeyScoped(partnerId);
  if (key) return key;

  let base64 = await getChatKey(partnerId);
  if (!base64) {
    await delay(250);
    base64 = await getChatKey(partnerId);
  }
  if (base64) {
    key = await importAESKey(base64);
    await saveAESKeyScoped(partnerId, key);
    return key;
  }

  const newKey = await generateAESKey();
  const raw = await exportAESKey(newKey);
  const base64Key = btoa(String.fromCharCode(...raw));
  await storeChatKey({ receiverId: partnerId, encryptedKey: base64Key });
  await saveAESKeyScoped(partnerId, newKey);
  return newKey;
}

function toAbsoluteFileUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://localhost:7146${url.startsWith('/') ? url : '/' + url}`
}
</script>

<style scoped>
</style>
