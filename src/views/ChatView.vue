<template>
  <div class="flex h-screen" dir="ltr">
    <ChatConversationList
      v-show="showListPane"
      :conversations="conversations"
      :selected-user-id="
        selectedUser?.id ?? null
      "
      :is-narrow="isNarrow"
      :online-ids="onlineIds"
      :avatar-by-id="avatarById"
      :display-by-id="displayById"
      @open-menu="menuOpen = true"
      @select="onConvDblClick"
    />

    <div class="flex-1 flex flex-col"
     v-show="showChatPane">

    <ChatConversationHeader
      :selection-mode="selectionMode"
      :selected-count="selectedCount"
      :selected-user="selectedUser"
      :selected-label="selectedLabel"
      :is-narrow="isNarrow"
      :show-back="
        (
          isNarrow &&
          !!selectedUser
        ) ||
        chatNavStack.length > 0
      "
      :avatar-url="
        selectedUser
          ? (
              avatarById[
                selectedUser.id
              ] ?? null
            )
          : null
      "
      :is-peer-typing="
        isPeerTyping
      "
      :is-peer-online="
        selectedUser
          ? onlineIds.has(
              selectedUser.id
            )
          : false
      "
      :peer-status="peerStatus"
      @open-profile="
        openPeerProfile
      "
      @back="onHeaderBack"
      @forward-selected="
        openForwardPickerMulti
      "
      @delete-selected="
        openDeleteConfirmMulti
      "
      @copy-selected="
        copySelectedText
      "
      @clear-selection="
        clearSelection
      "
    />

      <ChatMessageList
        :messages="messages"
        :my-id="myId"
        :loading-older="loadingOlder"
        :selection-mode="selectionMode"
        :chat-active="!!selectedUser"
        :context-menu="contextMenu"
        :quick-emojis="quickEmojis"
        :hover-react-for="hoverReactFor"
        :reaction-picker-for="reactionPickerFor"
        :downloaded="downloaded"
        :downloading="downloading"
        :file-size-map="fileSizeMap"
        :actions="messageListActions"
        :bind-message-element="bindMsgEl"
        :set-scroll-element="setMessageScrollElement"
        :set-menu-element="setMessageMenuElement"
      />

      <ChatComposer
        v-model="text"

        :visible="!!selectedUser"
        :can-send="canSend"

        :replying="!!replyingTo"
        :reply-preview="
          replyingTo
            ? resolveReplyPreview(
                replyingTo.id
              )
            : ''
        "

        :editing="!!editingMessage"

        :set-message-input="
          setComposerMessageInput
        "

        :set-file-input="
          setComposerFileInput
        "

        :set-media-input="
          setComposerMediaInput
        "

        @send="send"

        @composer-input="
          onComposerInput
        "

        @composer-blur="
          onBlurInput
        "

        @open-file="
          openFilePicker
        "

        @open-media="
          openMediaPicker
        "

        @files-chosen="
          onFilesChosen
        "

        @media-chosen="
          onMediaChosen
        "

        @cancel-reply="
          replyingTo = null
        "

        @cancel-edit="
          cancelEdit
        "
      />



      <ChatFileSendModal
        v-model:caption="pendingCaption"
        :open="showFileModal"
        :files="pendingFiles"
        :sending="sendingFile"
        :human-file-size="humanFileSize"
        @close="cancelFileSend"
        @remove-file="removePendingFile"
        @add-more="addAnotherFile"
        @send="confirmSendFile"
      />

    </div>

    <ChatForwardPicker
      :open="forwardPicker.visible"
      :mode="forwardPicker.mode"
      :count="forwardPicker.srcList.length"
      :conversations="conversations"
      @close="forwardPicker.visible=false"
      @select="doForward"
    />

    <ChatDeleteConfirmDialog
      v-model:for-all="confirmDel.forAll"
      :open="confirmDel.visible"
      :count="confirmDel.count"
      :can-all="confirmDel.canAll"
      @close="cancelDelete"
      @confirm="confirmDelete"
    />
          
    </div>
  <!-- Toast -->
  <div
    v-if="toast.show"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white text-sm px-3 py-2 rounded-full shadow"
  >
    {{ toast.text }}
  </div>
  <!-- Side Menu -->
  <SideMenu :open="menuOpen" :me="meProfile"
            @close="menuOpen=false"
            @action="onMenuAction" />

  <!-- Profile Modal -->
  <ProfileModal :open="showProfile" :me="meProfile"
                @close="showProfile=false"
                @edit="openSettings()" />

  <!-- Settings Modal: reuse SettingsView inside ModalSheet -->
  <ModalSheet :open="showSettings" @close="showSettings=false">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">Settings</div>
        <button class="text-gray-500 hover:text-gray-700" @click="showSettings=false">✕</button>
      </div>
      <SettingsView/>
    </div>
  </ModalSheet>

    <!-- Contacts Modal -->
  <ModalSheet :open="showContacts" @close="showContacts=false">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">Contacts</div>
        <button class="text-gray-500 hover:text-gray-700" @click="showContacts=false">✕</button>
      </div>
      <ContactsView :inModal="true" @open-chat="onOpenChatFromContacts" />
    </div>
  </ModalSheet>

  <ChatMediaSendModal
    v-model:caption="mediaCaption"
    v-model:group-items="mediaGroupItems"
    v-model:compress-images="compressImages"
    :open="showMediaModal"
    :files="pendingMedia"
    :sending="sendingMedia"
    :all-images-selected="allImagesSelected"
    :is-image-file="isImageFile"
    :preview-url="objUrl"
    @close="cancelMediaSend"
    @remove="removePendingMedia"
    @add-more="addAnotherMedia"
    @send="confirmSendMedia"
  />

  <MediaImageViewer v-if="showImageViewer"
                  :src="viewerImageSrc" :caption="viewerCaption"
                  @close="showImageViewer=false" />
  <MediaVideoPlayer v-if="showVideoPlayer"
                  :src="playerVideoSrc" :caption="playerCaption"
                  @close="showVideoPlayer=false" />


  <PeerProfileModal
  :open="showPeerProfile"
  :user="peerProfile"
  :isContact="isPeerInContacts"
  @close="showPeerProfile=false"
  @send-message="onPeerSendMessage"
  @add-contact="onPeerAddContact"
  @remove-contact="onPeerRemoveContact"
  @share-contact="onPeerShareContact"
/>

</template>



<script setup lang="ts">//----------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

import ChatMediaSendModal from '../features/chat/components/ChatMediaSendModal.vue'
import ChatForwardPicker from '../features/chat/components/ChatForwardPicker.vue'
import ChatDeleteConfirmDialog from '../features/chat/components/ChatDeleteConfirmDialog.vue'
import ChatMessageList from '../features/chat/components/ChatMessageList.vue'
import ChatFileSendModal from '../features/chat/components/ChatFileSendModal.vue'
import ChatComposer from '../features/chat/components/ChatComposer.vue'
import SideMenu from '../components/SideMenu.vue'
import ModalSheet from '../components/ModalSheet.vue'
import ProfileModal from '../components/ProfileModal.vue'
import ContactsView from './ContactsView.vue'   // NEW

import ChatConversationHeader from '../features/chat/components/ChatConversationHeader.vue'

const showContacts = ref(false)                 // NEW

import PeerProfileModal from '../components/PeerProfileModal.vue'
import SettingsView from './SettingsView.vue'

import { ref, onMounted,nextTick,onBeforeUnmount,reactive,computed, watch  } from 'vue'
import { getMessageBrief} from '../services/api'
import {
  connectToChatHub,
  createChatHubSubscriptionScope,
  disconnectFromChatHub,
  markAsRead,
  startTyping,
  stopTyping,
  fetchOnlineUsers
} from '../services/signalr'
import {
  decryptAES,
  importAESKey,
  generateAESKey,
  exportAESKey,


} from '../services/crypto'
import {
  getChatKey,
  getUserByUsername,
  storeChatKey,
  getConversationPaged,
  getConversations,
  getUserById,
  getMeProfile
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'

import { useRoute ,useRouter} from 'vue-router'
import {toDateSafe,formatRelativeEn} from "../utils/time";
import MediaImageViewer from '../components/MediaImageViewer.vue'
import MediaVideoPlayer from '../components/MediaVideoPlayer.vue'
import {getMyContacts, addContact, removeContact,getUsersList } from '../services/api'

import { isJwtExpired,parseJwt,getToken } from '../services/auth'

import { toAbsoluteServerUrl } from '../config/server'

import type {
  ChatUser,
  Contact,
  ServerMessage,
  UiConversation,
  UiMessage,
  UserApiItem
} from '../types/chat'

import {
  mapServerMessage
} from '../utils/messageMapper'

import { useChatComposer } from '../features/chat/composables/useChatComposer'
import { useMessageSelection } from '../features/chat/composables/useMessageSelection'
import { useMessageContext } from '../features/chat/composables/useMessageContext'
import { useMessageDelete } from '../features/chat/composables/useMessageDelete'
import { useMessageReactions } from '../features/chat/composables/useMessageReactions'
import { useMessageForward } from '../features/chat/composables/useMessageForward'
import { useMessageFiles } from '../features/chat/composables/useMessageFiles'
import { useMessageMedia } from '../features/chat/composables/useMessageMedia'

import ChatConversationList from '../features/chat/components/ChatConversationList.vue'

function resolveReplyPreview(replyId?: string | null): string {
  if (!replyId) return ''

  const same = messages.value.find(m => m.id === replyId || m.clientId === replyId)
  if (same) return same.plainText || (same.fileUrl ? '[مدیا]' : '—')

  const cached = replyPreviewCache[replyId]
  if (cached) return cached

  if (!pendingReplyFetch.has(replyId)) {
    pendingReplyFetch.add(replyId)
    fetchReplyPreview(replyId)
  }
  return 'در حال بارگذاری…'
}

const route = useRoute()
const router = useRouter()
const EMPTY_MSG_MARKER = '\u200B' 

const myId = ref<string>('')
const selectedUser = ref<Pick<ChatUser, 'id' | 'username'> | null>(null)
const messages = ref<UiMessage[]>([])
const text = ref('')
const unread = ref<Record<string, number>>({})

const isPeerTyping = ref(false)
let typingTimer: number | null = null
const TYPING_IDLE_MS = 2000

function clearPeerTyping() {
  isPeerTyping.value = false

  if (typingTimer !== null) {
    window.clearTimeout(typingTimer)
    typingTimer = null
  }
}

const scrollBox = ref<HTMLElement | null>(null)
const loadingConversation = ref(false)
const loadingOlder = ref(false)
const hasMore = ref(true)
const oldestId = ref<string | null>(null)
let chatSessionId = 0

const conversations = ref<UiConversation[]>([])

const ACTIVE_UID_KEY = 'phi.activeUserId';

const toast = reactive({ show: false, text: '' })

const menuOpen = ref(false)
const showProfile = ref(false)
const showSettings = ref(false)
const meProfile = ref<Partial<ChatUser> | null>(null)

type ChatTarget = {
  id: string
  username: string
}

type OpenChatOptions = {
  pushCurrent?: boolean
  resetStack?: boolean
  syncRoute?: boolean
  scrollToEnd?: boolean
}

const chatNavStack = ref<ChatTarget[]>([])

let routeSyncReady = false
let routeSyncRequestId = 0

const messageEls: Map<string, HTMLElement> = new Map()

const bindMsgEl = (key: string) => (el: Element | any | null) => {
  const dom = el && (el as any).$el ? (el as any).$el as HTMLElement : (el as HTMLElement | null)
  if (dom) messageEls.set(key, dom)
  else messageEls.delete(key)
}

const replyPreviewCache = reactive<Record<string, string>>({})
const pendingReplyFetch = new Set<string>()

const showPeerProfile = ref(false)
const peerProfile = ref<UserApiItem | null>(null)
const myContacts = ref<Contact[]>([])

const selectedLabel = computed(() => {
  const su = selectedUser.value
  if (!su) return ''
  const conv = conversations.value.find(c => c.peerId === su.id)
  return (conv?.displayName && conv.displayName.trim())
    || ('@' + su.username.replace(/^@/, ''))
})

const msgInput = ref<HTMLTextAreaElement|null>(null)

const {
  contextMenu,
  menuEl,
  replyingTo,
  editingMessage,

  openMenu,
  closeMenu,
  repositionMenu,

  startReplyFrom,
  doReply,

  doEdit,
  cancelEdit,
  completeEdit,

  isMine,
  canEdit,
  resetMessageContext
} = useMessageContext({
  myId,
  selectedUser,
  text,
  msgInput,
  scrollBox,
  startTyping,
  stopTyping
})


const onlineIds = reactive(new Set<string>())
const lastSeenMap = reactive<Record<string, string | null>>({})
const avatarById  = reactive<Record<string, string | null>>({})
const displayById = reactive<Record<string, string | null>>({})

const peerStatus = computed(() => {
  const su = selectedUser.value
  if (!su) return ''
  if (isPeerTyping.value) return 'is typing...'
  if (onlineIds.has(su.id)) return 'Online'
  const ls = lastSeenMap[su.id]
  return ls ? `Last seen ${formatRelativeEn(ls)}` : 'Last seen unknown'
})

const showImageViewer = ref(false)
const viewerImageSrc = ref<string>('');
const viewerCaption = ref<string>('')
const showVideoPlayer = ref(false)
const playerVideoSrc = ref<string>('');
const playerCaption = ref<string>('')


const signalR = createChatHubSubscriptionScope()

const isNarrow = ref(false)
const showListPane = computed(() => !isNarrow.value || !selectedUser.value)
const showChatPane = computed(() => !isNarrow.value || !!selectedUser.value)
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------



//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------


async function onHeaderBack() {
  if (chatNavStack.value.length) {
    await goBackChat()
    return
  }

  if (isNarrow.value && selectedUser.value) {
    await closeChat()
  }
}


function onBubbleDblClick(ev: MouseEvent, m: UiMessage) {
  if (selectionMode.value) return
  if (isInTextSelectable(ev.target)) return  
  startReplyFrom(m)
}

async function ensurePeerCached(uid: string) {
  if (displayById[uid] && avatarById[uid]) return
  try {
    const u = await getUserById(uid)
    if (u?.displayName) displayById[uid] = u.displayName
    if (u?.avatarUrl)   avatarById[uid]  = u.avatarUrl

    const idx = conversations.value.findIndex(c => c.peerId === uid)
    if (idx >= 0) {
      conversations.value[idx].displayName = u?.displayName ?? conversations.value[idx].displayName
      conversations.value[idx].avatarUrl   = u?.avatarUrl   ?? conversations.value[idx].avatarUrl
    }
  } catch {}
}

function resetState() {
  chatSessionId++

  conversations.value = []
  messages.value = []
  selectedUser.value = null
  unread.value = {}

  loadingConversation.value = false
  loadingOlder.value = false
  hasMore.value = true
  oldestId.value = null

  for (const key in displayById) delete displayById[key]
  for (const key in avatarById) delete avatarById[key]
  for (const key in lastSeenMap) delete lastSeenMap[key]

  onlineIds.clear()
  clearPeerTyping()

  text.value = ''
  resetMessageContext()
  cancelFileSend()
  cancelMediaSend()
}

function scrollToEndSmooth() {
  const el = scrollBox.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

type OutgoingMessageInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  sentAt?: string
  replyToMessageId?: string | null
  forwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
  groupId?: string | null
}

async function appendOutgoingMessage(
  peerId: string,
  input: OutgoingMessageInput
): Promise<UiMessage> {
  const message: UiMessage = {
    clientId:
      input.clientId ?? crypto.randomUUID(),

    senderId: myId.value,
    plainText: input.plainText,
    fileUrl: input.fileUrl,
    status: 'sending',

    sentAt:
      input.sentAt ??
      new Date().toISOString(),

    replyToMessageId:
      input.replyToMessageId ?? null,

    forwardedFromMessageId:
      input.forwardedFromMessageId ?? null,

    forwardedFromSenderId:
      input.forwardedFromSenderId ?? null,

    groupId:
      input.groupId ?? null
  }

  if (selectedUser.value?.id !== peerId) {
    return message
  }

  messages.value.push(message)

  if (message.forwardedFromSenderId) {
    cacheForwardName(
      message.forwardedFromSenderId
    )
  }

  await nextTick()

  if (selectedUser.value?.id === peerId) {
    const el = scrollBox.value

    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }

  return message
}

function updateConversationAfterSend(
  peerId: string,
  message: Pick<
    UiMessage,
    'plainText' | 'fileUrl' | 'sentAt'
  >,
  username?: string
) {
  const index = conversations.value.findIndex(
    conversation =>
      conversation.peerId === peerId
  )

  const sentAt =
    message.sentAt ??
    new Date().toISOString()

  if (index < 0) {
    if (!username) return

    conversations.value.unshift({
      peerId,
      username,
      displayName:
        displayById[peerId] ?? null,

      avatarUrl:
        avatarById[peerId] ?? null,

      unreadCount: 0,
      lastSentAt: sentAt,
      lastFileUrl: message.fileUrl,

      lastPreview:
        message.plainText ||
        (message.fileUrl ? null : '')
    })

    return
  }

  const conversation =
    conversations.value[index]

  conversation.lastSentAt = sentAt
  conversation.lastFileUrl = message.fileUrl

  conversation.lastPreview =
    message.plainText ||
    (message.fileUrl ? null : '')

  const [moved] =
    conversations.value.splice(index, 1)

  conversations.value.unshift(moved)
}


function onConvDblClick(conv: UiConversation) {
  if (selectedUser.value?.id === conv.peerId) {
    scrollToEndSmooth()
    return
  }

  void selectConversation(conv)
}






function openImage(msg: UiMessage){
  viewerImageSrc.value = msg.fileUrl || ''
  viewerCaption.value = msg.plainText || ''
  showImageViewer.value = true
}
function openVideo(msg: UiMessage){
  playerVideoSrc.value = msg.fileUrl || ''
  playerCaption.value = msg.plainText || ''
  showVideoPlayer.value = true
}


function isNearBottom(el: HTMLElement, threshold = 400) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

async function openPeerProfile() {
  if (!selectedUser.value) return
  const u = await getUserByUsername(selectedUser.value.username.replace(/^@/,''))
  peerProfile.value = u
  try { myContacts.value = await getMyContacts() } catch {}
  showPeerProfile.value = true
}

const isPeerInContacts = computed(() => {
  const username = peerProfile.value?.username
  return !!username &&
    myContacts.value.some(c => c.username === username)
})

async function onPeerAddContact(id: string) {
  await addContact(id)
  myContacts.value = await getMyContacts()
}

async function onPeerRemoveContact(id: string) {
  await removeContact(id)
  myContacts.value = await getMyContacts()
}

async function onPeerSendMessage(id: string) {
  const profile = peerProfile.value
  if (!profile) return

  await openChat(
    {
      id,
      username: profile.username
    },
    {
      resetStack: true
    }
  )

  showPeerProfile.value = false
}

async function onPeerShareContact(u: ChatUser) {
  const text = u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`
  await navigator.clipboard.writeText(text)
  showToast('Contact copied')
}








async function fetchReplyPreview(id: string) {
  try {
    const dto = await getMessageBrief(id)
    const plain = await decryptMessageText(dto.encryptedContent)
    replyPreviewCache[id] = plain || (dto.fileUrl ? '[مدیا]' : '—')
  } catch {
    replyPreviewCache[id] = 'نامشخص'
  } finally {
    pendingReplyFetch.delete(id)
  }
}


async function decryptMessageText(base64?: string | null): Promise<string> {
  if (!base64 || !selectedUser.value) return ''
  try {
    const key = await getOrLoadKey(selectedUser.value.id)
    const plain = await decryptAES(key, base64)
    return plain && plain !== EMPTY_MSG_MARKER ? plain : ''
  } catch {
    return '[رمزگشایی نشد]'
  }
}

function normalizeUsername(username: string) {
  return username.replace(/^@/, '').trim()
}

function currentChatRef(): ChatTarget | null {
  const user = selectedUser.value
  if (!user) return null

  return {
    id: user.id,
    username: normalizeUsername(user.username)
  }
}

function routeUsername(value: unknown) {
  return typeof value === 'string'
    ? normalizeUsername(value)
    : ''
}

async function replaceChatRoute(username?: string | null) {
  const target = username
    ? `/u/${encodeURIComponent(normalizeUsername(username))}`
    : '/chat'

  if (route.path !== target) {
    await router.replace(target)
  }
}

async function openChat(user: ChatTarget, options: OpenChatOptions = {}) {
  const target: ChatTarget = {
    id: String(user.id),
    username: normalizeUsername(user.username)
  }

  if (!target.id || !target.username) return

  const current = currentChatRef()

  if (options.resetStack) {
    chatNavStack.value = []
  }

  if (options.pushCurrent && current && current.id !== target.id) {
    const last = chatNavStack.value[chatNavStack.value.length - 1]

    if (last?.id !== current.id) {
      chatNavStack.value.push(current)
    }
  }

  if (selectedUser.value?.id !== target.id) {
    await handleUserSelect(target)
  } else if (selectedUser.value.username !== target.username) {
    selectedUser.value = target
  }

  if (options.syncRoute !== false) {
    await replaceChatRoute(target.username)
  }

  if (options.scrollToEnd) {
    await nextTick()
    scrollToEndSmooth()
  }
}

async function closeChat(syncRoute = true) {
  chatSessionId++
  chatNavStack.value = []
  selectedUser.value = null
  messages.value = []

  loadingConversation.value = false
  loadingOlder.value = false
  hasMore.value = true
  oldestId.value = null

  text.value = ''
  clearPeerTyping()
  resetMessageContext()

  if (syncRoute) {
    await replaceChatRoute(null)
  }
}

async function syncChatFromRoute(value: unknown) {
  const requestId = ++routeSyncRequestId
  const username = routeUsername(value)

  if (!username) {
    if (route.path === '/chat' && selectedUser.value) {
      await closeChat(false)
    }
    return
  }

  const selectedUsername = normalizeUsername(
    selectedUser.value?.username ?? ''
  )

  if (
    selectedUsername &&
    selectedUsername.toLowerCase() === username.toLowerCase()
  ) {
    return
  }

  try {
    const user = await getUserByUsername(username)

    if (requestId !== routeSyncRequestId) return

    await openChat(
      {
        id: user.id,
        username: user.username
      },
      {
        resetStack: true,
        syncRoute: false
      }
    )
  } catch {
    if (requestId !== routeSyncRequestId) return

    showToast('Username not found')
    await replaceChatRoute(null)
  }
}
async function goBackChat() {
  const previous = chatNavStack.value.pop()
  if (!previous) return

  await openChat(previous)
}

async function openMention(usernameOrAt: string) {
  const username = normalizeUsername(usernameOrAt)

  try {
    const user = await getUserByUsername(username)

    if (!user?.id || !user.username) {
      showToast('Username not found')
      return
    }

    await openChat(
      {
        id: user.id,
        username: user.username
      },
      {
        pushCurrent: true
      }
    )
  } catch {
    showToast('Username not found')
  }
}

async function onOpenChatFromContacts(user: ChatTarget) {
  showContacts.value = false

  await openChat(user, {
    resetStack: true
  })
}

function onMenuAction(a: 'profile'|'contacts'|'saved'|'settings') {
  menuOpen.value = false
  if (a === 'profile') {
    showProfile.value = true
  } else if (a === 'settings') {
    showSettings.value = true
  } else if (a === 'contacts') {
    showContacts.value = true
  } else if (a === 'saved') {
    goSavedMessages()
  }
}

function openSettings() {
  showProfile.value = false
  showSettings.value = true
}

async function goSavedMessages() {
  const username = normalizeUsername(meProfile.value?.username ?? '')
  if (!myId.value || !username) return

  await openChat(
    {
      id: myId.value,
      username
    },
    {
      resetStack: true
    }
  )
}


function showToast(t: string) {
  toast.text = t
  toast.show = true
  setTimeout(() => { toast.show = false }, 1400)
}

const {
  selectionMode,
  selectedMessages,
  selectedCount,
  allSelectedAreMine,
  getMsgKey,
  isSelected,
  toggleSelect,
  clearSelection,
  isInTextSelectable,
  onRowMouseDown,
  onRowMouseEnter,
  onRowClick,
  startSelectionFrom,
  onKeydownSelection,
  copySelectedText,
  disposeSelection
} = useMessageSelection({
  messages,
  myId,
  scrollBox,

  canSelect: () =>
    !!selectedUser.value,

  closeMenu,
  showToast
})

const {
  confirmDel,
  openDeleteConfirmSingle,
  openDeleteConfirmMulti,
  cancelDelete,
  confirmDelete
} = useMessageDelete({
  messages,
  selectedMessages,
  selectedCount,
  allSelectedAreMine,
  isMine,
  clearSelection,
  showToast
})

const {
  quickEmojis,
  reactionPickerFor,
  hoverReactFor,

  applyReaction,
  keepHoverBar,
  hideHoverBarSoon,
  onBubbleHoverStart,
  onBubbleHoverEnd,

  handleReactionUpdated,
  resetReactionUi,
  disposeReactions
} = useMessageReactions({
  messages,
  myId,
  getMsgKey,
  closeMenu
})

const {
  forwardPicker,
  openForwardPicker,
  openForwardPickerMulti,
  doForward,
  cacheForwardName,
  resolveForwardLabel,
  openForwardUser
} = useMessageForward({
  messages,
  conversations,
  selectedUser,
  selectedMessages,
  selectedCount,
  myId,

  getContextMessage: () =>
    contextMenu.value.msg,

  closeMenu,
  clearSelection,
  showToast,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend,

  openUserChat: user =>
    openChat(user, {
      pushCurrent: true
    })
})

const {
  fileInput,
  pendingFiles,
  pendingCaption,
  showFileModal,
  sendingFile,

  downloaded,
  downloading,
  fileSizeMap,

  openFilePicker,
  onFilesChosen,
  removePendingFile,
  cancelFileSend,
  addAnotherFile,
  confirmSendFile,

  fileKey,
  fileNameFromUrl,
  humanFileSize,
  ensureFileSize,
  downloadFile
} = useMessageFiles({
  selectedUser,
  replyingTo,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend
})

const {
  mediaInput,
  pendingMedia,
  showMediaModal,
  sendingMedia,
  mediaCaption,
  mediaGroupItems,
  compressImages,
  allImagesSelected,

  openMediaPicker,
  onMediaChosen,
  addAnotherMedia,
  removePendingMedia,
  cancelMediaSend,
  confirmSendMedia,

  isImageFile,
  objUrl,
  disposeMedia
} = useMessageMedia({
  selectedUser,
  replyingTo,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend
})

const {
  canSend,
  loadDraft,
  autoGrow,
  onComposerInput,
  onBlurInput,
  send
} = useChatComposer({
  myId,
  selectedUser,
  text,
  msgInput,
  editingMessage,
  replyingTo,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend,
  completeEdit
})

const messageListActions={
  onScroll:onScrollLoadMore,
  onRowClick,
  onRowMouseDown,
  onRowMouseEnter,
  onBubbleDblClick,
  onBubbleHoverStart,
  onBubbleHoverEnd,
  openMenu,
  jumpToReply:jumpToReplied,
  resolveReplyPreview,
  cacheForwardName,
  resolveForwardLabel,
  openForwardUser,
  openMention,
  openImage,
  openVideo,
  fileKey,
  fileNameFromUrl,
  humanFileSize,
  downloadFile,
  applyReaction,
  keepHoverBar,
  hideHoverBarSoon,
  closeReactionPicker:()=>{ reactionPickerFor.value=null },
  isSelected,
  toggleSelect,
  closeMenu,
  startSelection:startSelectionFrom,
  openForwardPicker,
  reply:doReply,
  edit:doEdit,
  canEdit,
  deleteMessage:(message:UiMessage)=>{
    closeMenu()
    openDeleteConfirmSingle(message)
  }
}

watch(selectedUser, async (current, previous) => {
  clearSelection()
  resetReactionUi()
  clearPeerTyping()

  if (previous?.id && previous.id !== current?.id) {
    void stopTyping(previous.id).catch(() => {})
  }

  await nextTick()
  autoGrow(undefined, { animate: false })

  if (!current) return

  const needsProfile =
    !lastSeenMap[current.id] ||
    !displayById[current.id] ||
    avatarById[current.id] === undefined

  if (!needsProfile) return

  try {
    const user = await getUserById(current.id)

    if (user?.lastSeenUtc) lastSeenMap[current.id] = user.lastSeenUtc
    if (user?.displayName) displayById[current.id] = user.displayName
    if (user?.avatarUrl) avatarById[current.id] = user.avatarUrl
  } catch {}
}, { immediate: true })


watch(
  () => route.params.username,
  username => {
    if (!routeSyncReady) return
    void syncChatFromRoute(username)
  }
)



watch(selectedCount, count => {
  if (
    count === 0 &&
    selectionMode.value
  ) {
    selectionMode.value = false
  }
})



function setMessageScrollElement(element:HTMLElement|null){
  scrollBox.value=element
}

function setMessageMenuElement(element:HTMLElement|null){
  menuEl.value=element
}

function setComposerMessageInput(
  element:
    HTMLTextAreaElement | null
) {
  msgInput.value = element
}

function setComposerFileInput(
  element:
    HTMLInputElement | null
) {
  fileInput.value = element
}

function setComposerMediaInput(
  element:
    HTMLInputElement | null
) {
  mediaInput.value = element
}


function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}
function onWindowScroll() {
  closeMenu()
}
function onWindowResize() {
  repositionMenu()
  isNarrow.value =
    window.innerWidth < 768
}

function registerPageListeners() {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keydown', onKeydownSelection)
  window.addEventListener('scroll', onWindowScroll, true)
  window.addEventListener('resize', onWindowResize)
}

function unregisterPageListeners() {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keydown', onKeydownSelection)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', onWindowResize)
}

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

function scrollToMessageEl(el: HTMLElement) {
  const sc = scrollBox.value as HTMLElement | null
  if (!sc) return
  const scRect = sc.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const offset = elRect.top - scRect.top
  const target = sc.scrollTop + offset - (sc.clientHeight / 2) + (el.clientHeight / 2)
  sc.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

async function jumpToReplied(replyId: string) {
  let el = messageEls.get(replyId)

  if (!el) {
    for (let i = 0; i < 5 && !el; i++) {
      const loaded = await loadOlderMessages()

      await nextTick()
      el = messageEls.get(replyId)

      if (!loaded) break
    }
  }

  if (el) {
    scrollToMessageEl(el)

    el.classList.add(
      'ring-2',
      'ring-yellow-400'
    )

    setTimeout(() => {
      el?.classList.remove(
        'ring-2',
        'ring-yellow-400'
      )
    }, 1000)
  } else {
    showToast(
      'برای دیدن پیام قدیمی‌تر، کمی بالاتر بروید'
    )
  }
}

function isActiveChat(
  sessionId: number,
  userId: string
) {
  return (
    sessionId === chatSessionId &&
    selectedUser.value?.id === userId
  )
}

type PreparedMessagePage = {
  messages: UiMessage[]
  source: ServerMessage[]
  hasMore: boolean
  oldestId: string | null
}

function serverMessageId(message: ServerMessage) {
  return message.messageId ?? message.MessageId ?? message.id ?? ''
}

function serverSenderId(message: ServerMessage) {
  return String(message.senderId ?? message.SenderId ?? '')
}

function serverMessageIsDeleted(message: ServerMessage) {
  return Boolean(message.isDeleted ?? message.IsDeleted)
}

function serverMessageIsUnread(message: ServerMessage) {
  return (message.isRead ?? message.IsRead) !== true
}

async function prepareMessagePage(
  userId: string,
  beforeId: string | undefined,
  sessionId: number
): Promise<PreparedMessagePage | null> {
  const page = await getConversationPaged(userId, beforeId, 50)

  if (!isActiveChat(sessionId, userId)) return null

  const visibleItems = page.items.filter(message => !serverMessageIsDeleted(message))

  if (!visibleItems.length) {
    return {
      messages: [],
      source: page.items,
      hasMore: page.hasMore,
      oldestId: page.oldestId
    }
  }

  const aesKey = await getOrLoadKey(userId)

  if (!isActiveChat(sessionId, userId)) return null

  const prepared = await Promise.all(
    visibleItems.map(async message => {
      const ui = await mapServerMessage(message, {
        aesKey,
        myId: myId.value,
        cipherSource: 'content',
        decryptFailureText: '[رمزگشایی نشد]'
      })

      if (ui.forwardedFromSenderId) {
        void cacheForwardName(ui.forwardedFromSenderId)
      }

      return ui
    })
  )

  if (!isActiveChat(sessionId, userId)) return null

  for (const message of prepared) {
    if (!message.fileUrl) continue

    const key = fileKey(message)
    if (!fileSizeMap[key]) {
      void ensureFileSize(message.fileUrl, key)
    }
  }

  return {
    messages: prepared,
    source: page.items,
    hasMore: page.hasMore,
    oldestId: page.oldestId
  }
}

async function loadOlderMessages(): Promise<boolean> {
  const user = selectedUser.value

  if (
    !user ||
    !hasMore.value ||
    loadingConversation.value ||
    loadingOlder.value
  ) {
    return false
  }

  const sessionId = chatSessionId
  const element = scrollBox.value
  const previousHeight = element?.scrollHeight ?? 0
  const previousTop = element?.scrollTop ?? 0

  loadingOlder.value = true

  try {
    let cursor = oldestId.value || undefined

    // اگر یک صفحه فقط پیام حذف‌شده داشت،
    // حداکثر پنج صفحه جلوتر بررسی می‌شود.
    for (let attempt = 0; attempt < 5; attempt++) {
      const page = await prepareMessagePage(user.id, cursor, sessionId)
      if (!page) return false

      hasMore.value = page.hasMore
      oldestId.value = page.oldestId

      if (page.messages.length) {
        messages.value = [...page.messages, ...messages.value]

        await nextTick()

        if (isActiveChat(sessionId, user.id) && element) {
          element.scrollTop =
            previousTop + element.scrollHeight - previousHeight
        }

        return true
      }

      if (
        !page.hasMore ||
        !page.oldestId ||
        page.oldestId === cursor
      ) {
        return false
      }

      cursor = page.oldestId
    }

    return false
  } catch (error) {
    if (isActiveChat(sessionId, user.id)) {
      console.warn('load older messages failed', error)
    }

    return false
  } finally {
    if (sessionId === chatSessionId) {
      loadingOlder.value = false
    }
  }
}


async function selectConversation(conv: UiConversation) {
  await openChat(
    {
      id: conv.peerId,
      username: conv.username
    },
    {
      resetStack: true,
      scrollToEnd: true
    }
  )
}





async function onScrollLoadMore() {
  const el = scrollBox.value

  if (!el || el.scrollTop > 80) {
    return
  }

  await loadOlderMessages()
}



async function initializeChatPage() {
  routeSyncReady = false
  routeSyncRequestId++
  resetState()
  const token = getToken()
  if (!token || isJwtExpired(token)) {
    router.replace('/login')
    return
  }

  try { await disconnectFromChatHub() } catch {}


  if (token) {
    const payload = parseJwt(token)
    myId.value = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? ''
    try { localStorage.setItem(ACTIVE_UID_KEY, myId.value); } catch {}

    wireSignalR()

    try {
      await connectToChatHub(token)

      const ids =
        await fetchOnlineUsers()

      onlineIds.clear()

      ids.forEach(id =>
        onlineIds.add(String(id))
      )
    } catch (error) {
      console.warn(
        'initial SignalR connection failed',
        error
      )
    }
  }
  

  try {
      const data = await getConversations() 

      const me = await getMeProfile()
      meProfile.value = me

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

      try {
        const all = await getUsersList()
        const peerIds = new Set(conversations.value.map(c => c.peerId))
        for (const u of all) {
          if (!peerIds.has(u.id)) continue
          if (u.lastSeenUtc) lastSeenMap[u.id] = u.lastSeenUtc
          if (u.displayName) displayById[u.id] = u.displayName
          if (u.avatarUrl)   avatarById[u.id]  = u.avatarUrl
        }
      } catch {}

      for (const c of conversations.value) {
          if (c.displayName) displayById[c.peerId] = c.displayName
          if (c.avatarUrl)   avatarById[c.peerId]  = c.avatarUrl
        }


      conversations.value.sort((a, b) => {
        const ta = toDateSafe(a.lastSentAt)?.getTime() || 0
        const tb = toDateSafe(b.lastSentAt)?.getTime() || 0
        return tb - ta
      })
    } catch (e) {
      console.warn('load conversations failed', e)
    }
  routeSyncReady = true
  await syncChatFromRoute(route.params.username)

}

onMounted(async () => {
  onWindowResize()
  registerPageListeners()

  await nextTick()
  autoGrow(undefined, { animate: false })

  try {
    await initializeChatPage()
  } catch (error) {
    console.error('chat initialization failed', error)
  }
})

onBeforeUnmount(() => {
  routeSyncReady = false
  routeSyncRequestId++
  chatSessionId++

  unregisterPageListeners()
  disposeSelection()
  disposeReactions()
  disposeMedia()
  signalR.dispose()
  clearPeerTyping()

  void disconnectFromChatHub().catch(() => {})
})

function wireSignalR() {
  signalR.dispose()

  signalR.onUserOnline(userId => {
    onlineIds.add(
      String(userId)
    )
  })

  signalR.onUserOffline(
    (userId, when) => {
      const id =
        String(userId)

      onlineIds.delete(id)

      if (when) {
        lastSeenMap[id] = when
      }
    }
  )

  signalR.onOnlineSnapshot(ids => {
    onlineIds.clear()

    ids.forEach(id => {
      onlineIds.add(
        String(id)
      )
    })
  })

  signalR.onUserLastSeen(
    (userId, whenIso) => {
      lastSeenMap[
        String(userId)
      ] = whenIso
    }
  )
  signalR.onMessageReceived(async (message: any) => {

    const senderId = String(message.senderId ?? message.SenderId)
    await ensurePeerCached(senderId)

    const ci = conversations.value.findIndex(c => c.peerId === senderId)
    if (ci >= 0) {
      if (displayById[senderId]) conversations.value[ci].displayName = displayById[senderId]!
      if (avatarById[senderId])   conversations.value[ci].avatarUrl   = avatarById[senderId]!
    }
    
    // unify fields
    const isFromOtherPeer =
      selectedUser.value &&
      senderId !== selectedUser.value.id

    const isMyEcho =
      senderId === myId.value

    if (!selectedUser.value || isFromOtherPeer || isMyEcho) {
      if (!isMyEcho) {
        const sid = senderId
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
          let uname = (message.senderUsername || '').replace(/^@/, '')
          let disp  = displayById[sid] || null
          let avatar = avatarById[sid] || null

          if (!uname || !disp || !avatar) {
            try {
              const u = await getUserById(sid)
              if (u) {
                uname  = (u.username || uname || '').replace(/^@/, '')
                disp   = (u.displayName || disp || null)
                avatar = (u.avatarUrl   || avatar || null)
                if (u.displayName) displayById[sid] = u.displayName
                if (u.avatarUrl)   avatarById[sid]  = u.avatarUrl
              }
            } catch { /* ignore */ }
          }

          conversations.value.unshift({
            peerId: sid,
            username: uname,               
            displayName: disp || null,     
            avatarUrl: avatar || null,
            unreadCount: 1,
            lastSentAt: msgTime,
            lastFileUrl: message.fileUrl || null,
            lastPreview: (message.fileUrl ? null : 'پیام جدید'),
          } as UiConversation)
        }
      }
      return
    }

    const aesKey =
      await getOrLoadKey(senderId)

    const ui = await mapServerMessage(
      message as ServerMessage,
      {
        aesKey,
        myId: myId.value,
        cipherSource: 'text',
        fallbackSentAt:
          new Date().toISOString(),

        retryKey: () =>
          getOrLoadKey(senderId)
      }
    )

    if (ui.forwardedFromSenderId) {
      cacheForwardName(
        ui.forwardedFromSenderId
      )
    }

    const el0 = scrollBox.value as HTMLElement | null
    const stick = !!el0 && isNearBottom(el0)

    messages.value.push(ui)

    if (ui.fileUrl) {
      const key = fileKey(ui)
      if (!fileSizeMap[key]) ensureFileSize(ui.fileUrl, key)
    }

    await nextTick()
    const box = scrollBox.value as HTMLElement | null
    if (box && stick) box.scrollTop = box.scrollHeight
    await nextTick()
    const mid = message.messageId || message.id || message.MessageId
    if (mid) {
      try { await markAsRead(mid) } catch {}
    }
})


  signalR.onDelivered(async (info: any) => {
    const cid = info.clientId ?? info.ClientId
    let m = cid ? messages.value.find(x => x.clientId === cid) : undefined

    const el0 = scrollBox.value as HTMLElement | null
    const stick = !!el0 && isNearBottom(el0)

    if (!m && info.messageId) {
      m = [...messages.value].reverse().find(x =>
        x.senderId === myId.value && x.status === 'sending' && !x.id
      )
    }
    if (!m) return

    if (info.messageId) m.id = info.messageId
    if (info.sentAt)    m.sentAt = info.sentAt

    m.status = 'delivered'

    const fileUrl = info.fileUrl ?? info.FileUrl ?? null
    if (fileUrl) {
      m.fileUrl = toAbsoluteFileUrl(fileUrl)
      const k = fileKey(m)
      if (!fileSizeMap[k]) ensureFileSize(m.fileUrl!, k)
    }

    const raw: string = String(info.encryptedText ?? info.EncryptedText ?? '')
    if (raw && raw.trim()) {
      try {
        const partnerId = selectedUser.value?.id
        if (partnerId) {
          const key = await getOrLoadKey(partnerId)
          const txt = await decryptAES(key, raw)
          if (txt && txt !== EMPTY_MSG_MARKER) m.plainText = txt
          else m.plainText = ''
        }
      } catch { /* ignore */ }
    }

    await nextTick()
    const el = scrollBox.value as HTMLElement | null
    if (el && stick) el.scrollTop = el.scrollHeight
    await nextTick()
  })




  signalR.onMessageRead((info: any) => {
    const m = messages.value.find(x => x.id === info.messageId)
    if (m) {
      m.status = 'read'
      if (info.readAtUtc) m.readAtUtc = info.readAtUtc
    }
  })


  signalR.onTyping(payload => {
    const senderId = String(payload.SenderId || '')

    if (!senderId || senderId !== selectedUser.value?.id) return

    isPeerTyping.value = true

    if (typingTimer !== null) {
      window.clearTimeout(typingTimer)
    }

    typingTimer = window.setTimeout(() => {
      isPeerTyping.value = false
      typingTimer = null
    }, TYPING_IDLE_MS)
  })

  signalR.onTypingStopped(payload => {
    const senderId = String(payload.SenderId || '')

    if (!senderId || senderId !== selectedUser.value?.id) return

    clearPeerTyping()
  })

  signalR.onMessageEdited(async (p) => {
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

  signalR.onMessageDeleted((p) => {
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

  signalR.onReactionUpdated(
    handleReactionUpdated
  )
  }

async function handleUserSelect(user: ChatTarget) {
  const sessionId = ++chatSessionId

  selectedUser.value = user
  messages.value = []
  text.value = loadDraft(user.id)

  hasMore.value = true
  oldestId.value = null
  loadingOlder.value = false
  loadingConversation.value = true

  const conversation = conversations.value.find(item => item.peerId === user.id)

  if (conversation) {
    conversation.unreadCount = 0
  }

  unread.value[user.id] = 0

  try {
    const page = await prepareMessagePage(user.id, undefined, sessionId)
    if (!page) return

    hasMore.value = page.hasMore
    oldestId.value = page.oldestId
    messages.value = page.messages

    await nextTick()

    if (!isActiveChat(sessionId, user.id)) return

    const element = scrollBox.value
    if (element) element.scrollTop = element.scrollHeight

    const unreadIds = page.source
      .filter(message =>
        !serverMessageIsDeleted(message) &&
        serverSenderId(message) === user.id &&
        serverMessageIsUnread(message)
      )
      .map(serverMessageId)
      .filter((id): id is string => Boolean(id))

    void Promise.allSettled(unreadIds.map(id => markAsRead(id)))
  } catch (error) {
    if (isActiveChat(sessionId, user.id)) {
      console.warn('load conversation failed', error)
      showToast('بارگذاری گفتگو ناموفق بود')
    }
  } finally {
    if (isActiveChat(sessionId, user.id)) {
      loadingConversation.value = false
    }
  }
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
  return url ? toAbsoluteServerUrl(url) : null
}
</script>

<style>
/* global (بدون scoped) تا روی span داینامیکی هم اعمال بشه */
.ripple-ink {
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity: .15;
  transform: scale(0);
  pointer-events: none;
  animation: ripple .5s ease-out forwards;
}
@keyframes ripple {
  to { transform: scale(4); opacity: 0; }
}

/* منوی راست‌کلیک: پاپ/محو کوتاه */
.fade-enter-from   { opacity: 0; transform: translateY(4px) scale(0.98); transform-origin: bottom right; }
.fade-enter-active { transition: opacity .12s ease, transform .12s ease; }
.fade-leave-active { transition: opacity .10s ease, transform .10s ease; }
.fade-leave-to     { opacity: 0; transform: translateY(6px) scale(0.98); }



/* منوی سنجاق: از پایین به بالا پاپ شود */
.clip-pop-enter-from   { opacity: 0; transform: translateY(6px) scale(0.98); transform-origin: bottom right; }
.clip-pop-enter-active { transition: opacity .12s ease, transform .12s ease; }
.clip-pop-leave-active { transition: opacity .10s ease, transform .10s ease; }
.clip-pop-leave-to     { opacity: 0; transform: translateY(6px) scale(0.98); }

/* header (selection/non-selection) slide */
.slide-down-enter-from { transform: translateY(-6px); opacity: 0; }
.slide-down-enter-active { transition: transform .1s ease, opacity .1s ease; }
.slide-down-leave-active { transition: transform .08s ease, opacity .08s ease; }
.slide-down-leave-to { transform: translateY(-4px); opacity: 0; }
@reference "tailwindcss";

/* unified inputs & buttons using your palette */
.input {
  @apply border rounded-lg px-3 py-2 outline-none bg-white
         ring-1 ring-[#456173]/15
         focus:ring-2 focus:ring-[#11BFAE]/60 focus:border-[#11BFAE];
}
.btn-primary {
  @apply inline-flex items-center justify-center
         bg-[#11BFAE] text-white rounded-lg px-4 py-2
         ring-1 ring-[#11BFAE]/20
         hover:bg-[#10B2A3] hover:ring-[#11BFAE]/30
         transition disabled:opacity-60;
}
.btn-outline {
  @apply inline-flex items-center justify-center
         bg-white text-[#1B3C59] rounded-lg px-3 py-2
         ring-1 ring-[#456173]/25
         hover:bg-[#F2F2F0] hover:ring-[#456173]/40
         transition disabled:opacity-60;
}
.btn-ghost {
  @apply inline-flex items-center justify-center
         text-[#456173] rounded-lg px-2 py-1
         ring-1 ring-transparent
         hover:bg-[#F2F2F0] hover:text-[#1B3C59]
         transition;
}
.btn-danger {
  @apply inline-flex items-center justify-center
         text-red-600 rounded-lg px-2 py-1
         ring-1 ring-red-500/10
         hover:bg-red-50 hover:ring-red-500/30
         transition;
}


.fade-scale-enter-from   { opacity: 0; transform: translateY(4px) scale(0.98); }
.fade-scale-enter-active { transition: opacity .12s ease, transform .12s ease; }
.fade-scale-leave-active { transition: opacity .10s ease, transform .10s ease; }
.fade-scale-leave-to     { opacity: 0; transform: translateY(6px) scale(0.98); }


.menu-item:first-child { position: relative; z-index: 0; overflow: hidden; border-top-left-radius: 1rem; border-top-right-radius: 1rem; }

.menu-item + .menu-item {
  border-top: 1px solid rgba(69,97,115,0.10);
}

:global(.ripple-ink){
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity:.15;
  transform: scale(0);
  pointer-events:none;
  animation: ripple .5s ease-out forwards;
}

.auto-dir { unicode-bidi: plaintext; }

.text-start { text-align: start; }

.composer textarea {
  resize: none !important;
  overflow-y: auto;
}
.composer textarea::-webkit-resizer { display: none; } 


.tg-text{
  -ms-overflow-style: none;   /* IE/Edge legacy */
  scrollbar-width: none;      /* Firefox */
}
.tg-text::-webkit-scrollbar{  /* Chrome/Safari */
  width:0; height:0;
}

.tg-fade{
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,1) 10px);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,1) 10px);
}


@keyframes ripple { to { transform: scale(4); opacity:0; } }

</style>