<template>
  <div class="flex h-[100dvh] overflow-hidden bg-canvas">
    <ChatConversationList
      v-show="showListPane"
      :conversations="conversations"
      :selected-user-id="
        selectedUser?.id ?? null
      "
      :is-narrow="isNarrow"
      :online-ids="onlineIds"
      :muted-ids="mutes.ids"
      :my-id="myId"
      :avatar-by-id="avatarById"
      :display-by-id="displayById"
      @open-menu="menuOpen = true"
      @select="onConvDblClick"
    />

    <div class="relative flex-1 min-w-0 flex flex-col"
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
        selectedUser && !selectedUser.isGroup
          ? onlineIds.has(
              selectedUser.id
            )
          : false
      "
      :peer-status="peerStatus"
      :is-muted="mutes.isMuted(selectedUser?.id)"
      :saved="isSavedChat"
      @toggle-mute="toggleMute"
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
      @search="search.show()"
    />

      <ChatSearchBar
        v-if="selectedUser && search.open.value"
        v-model:query="search.query.value"
        :index="search.index.value"
        :total="search.results.value.length"
        :has-more="hasMore"
        :loading-older="search.loadingOlder.value"
        @go="search.go"
        @search-older="search.searchOlder()"
        @close="search.close()"
      />

      <ChatPinnedBar
        v-if="selectedUser && pins.current.value"
        :text="pins.current.value.text"
        :index="pins.index.value"
        :count="pins.pins.value.length"
        @open="pins.showCurrent()"
        @unpin="pins.unpinCurrent()"
      />

      <ChatSecurityBanner
        v-if="selectedUser"
        :peer-name="selectedUser.isGroup ? changedMemberNames : selectedLabel"
        :key-changed="selectedUser.isGroup ? changedMembers.length > 0 : !!e2ee.keyChanged[selectedUser.id]"
        :missing-key="!selectedUser.isGroup && !!e2ee.peerMissingKey[selectedUser.id]"
        @view-code="selectedUser.isGroup ? openUserProfile(changedMembers[0]?.username) : openPeerProfile()"
        @acknowledge="acknowledgeKeyChange"
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
        :group="groupRendering"
        :hide-read-state="isSavedChat"
      />

      <div v-if="!selectedUser" class="absolute inset-0 grid place-items-center pointer-events-none">
        <span class="rounded-full bg-surface/85 backdrop-blur px-4 py-1.5 text-sm text-muted shadow-sm">
          {{ $t('chat.selectChat') }}
        </span>
      </div>

      <!-- Blocked: no composer, offer to unblock -->
      <div v-if="selectedUser && peerBlocked" class="shrink-0 bg-surface border-t border-line p-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <span class="text-sm text-muted">{{ $t('chat.youBlockedUser') }}</span>
        <button type="button" class="btn-secondary px-4 py-1.5 text-sm" @click="blocks.unblock(selectedUser.id)">
          {{ $t('profile.unblock') }}
        </button>
      </div>

      <ChatComposer
        v-model="text"

        :visible="!!selectedUser && !peerBlocked"
        :can-send="canSend"
        :can-record="!!selectedUser && !peerBlocked && !e2ee.peerMissingKey[selectedUser.id]"
        :link-preview="linkPreview.preview.value"
        :link-preview-loading="linkPreview.loading.value"
        @dismiss-preview="linkPreview.dismiss()"
        @send-voice="onSendVoice"
        @voice-error="onVoiceError"

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
      :my-id="myId"
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
    class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] bg-[#1f2a35]/95 text-white text-sm px-4 py-2 rounded-xl shadow-lg"
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
  <ModalSheet wide :open="showSettings" @close="showSettings=false">
    <SettingsView in-modal @close="showSettings=false"/>
  </ModalSheet>

    <!-- Contacts Modal -->
  <ModalSheet :open="showContacts" @close="showContacts=false">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">{{ $t('contacts.title') }}</div>
        <button class="text-muted hover:text-ink" :aria-label="$t('common.close')" @click="showContacts=false">✕</button>
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
  :is-blocked="blocks.isBlocked(peerProfile?.id)"
  @block="askBlock"
  @unblock="onUnblock"
  @close="showPeerProfile=false"
  @send-message="onPeerSendMessage"
  @add-contact="onPeerAddContact"
  @remove-contact="onPeerRemoveContact"
  @share-contact="onPeerShareContact"
/>

  <ConfirmDialog
    :open="!!blockTarget"
    :title="$t('profile.blockTitle')"
    :message="$t('profile.blockConfirm', { name: blockTargetName })"
    :confirm-label="$t('profile.block')"
    :busy="blocking"
    danger
    @cancel="blockTarget = null"
    @confirm="confirmBlock"
  />

  <NewGroupModal
    :open="showNewGroup"
    :people="groupCandidates"
    @close="showNewGroup = false"
    @created="onGroupCreated"
  />

  <GroupInfoModal
    :open="showGroupInfo"
    :group-id="selectedUser?.isGroup ? selectedUser.id : null"
    :my-id="myId"
    :online-ids="onlineIds"
    :people="groupCandidates"
    :muted="mutes.isMuted(selectedUser?.id)"
    @close="showGroupInfo = false"
    @toggle-mute="toggleMute"
    @open-user="username => { showGroupInfo = false; void openUserProfile(username) }"
    @left="onLeftGroup"
  />

  <!-- Until this device has the account's encryption key nothing else is usable. -->
  <E2eeGate v-if="e2ee.status !== 'ready' && e2ee.status !== 'idle'" />

</template>



<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import ChatConversationList from '../features/chat/components/ChatConversationList.vue'
import ChatConversationHeader from '../features/chat/components/ChatConversationHeader.vue'
import ChatMessageList from '../features/chat/components/ChatMessageList.vue'
import ChatComposer from '../features/chat/components/ChatComposer.vue'
import ChatFileSendModal from '../features/chat/components/ChatFileSendModal.vue'
import ChatMediaSendModal from '../features/chat/components/ChatMediaSendModal.vue'
import ChatForwardPicker from '../features/chat/components/ChatForwardPicker.vue'
import ChatDeleteConfirmDialog from '../features/chat/components/ChatDeleteConfirmDialog.vue'
import SideMenu from '../components/SideMenu.vue'
import ModalSheet from '../components/ModalSheet.vue'
import ProfileModal from '../components/ProfileModal.vue'
import PeerProfileModal from '../components/PeerProfileModal.vue'
import MediaImageViewer from '../components/MediaImageViewer.vue'
import MediaVideoPlayer from '../components/MediaVideoPlayer.vue'
import ContactsView from './ContactsView.vue'
import SettingsView from './SettingsView.vue'

import {
  addContact,
  getConversationPaged,
  getConversations,
  getErrorMessage,
  getMessageBrief,
  getMyContacts,
  getUserByUsername,
  logout,
  removeContact
} from '../services/api'
import {
  connectToChatHub,
  createChatHubSubscriptionScope,
  disconnectFromChatHub,
  markAsRead,
  markGroupRead,
  startTyping,
  stopTyping,
  fetchOnlineUsers
} from '../services/signalr'
import { isJwtExpired, getToken } from '../services/auth'
import { toAbsoluteServerUrl } from '../config/server'
import { useSessionStore } from '../stores/session'
import { useE2eeStore } from '../stores/e2ee'
import E2eeGate from '../features/e2ee/E2eeGate.vue'
import ChatSecurityBanner from '../features/chat/components/ChatSecurityBanner.vue'
import ChatSearchBar from '../features/chat/components/ChatSearchBar.vue'
import ChatPinnedBar from '../features/chat/components/ChatPinnedBar.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useBlocksStore } from '../stores/blocks'
import { useMutesStore } from '../stores/mutes'
import { usePreferencesStore } from '../stores/preferences'
import { clearChatNotifications, playNotificationSound, showMessageNotification } from '../services/notifications'
import { syncPushSubscription } from '../services/push'
import { useGroupsStore } from '../stores/groups'
import { markGroupChat } from '../services/chatKinds'
import { describeSystemEvent } from '../utils/groupEvents'
import { colorFromString } from '../utils/avatar'
import NewGroupModal from '../features/groups/NewGroupModal.vue'
import GroupInfoModal from '../features/groups/GroupInfoModal.vue'
import type { PickablePerson } from '../features/groups/MemberPicker.vue'
import type { GroupDetails } from '../services/api'
import { previewText } from '../features/chat/composables/useConversations'
import { useLinkPreview } from '../features/chat/composables/useLinkPreview'
import { useMessageSearch } from '../features/chat/composables/useMessageSearch'
import { usePinnedMessages } from '../features/chat/composables/usePinnedMessages'
import type { RecordedVoice } from '../features/chat/composables/useVoiceRecorder'

import type {
  ChatUser,
  Contact,
  ServerMessage,
  UiConversation,
  UiMessage,
  UserApiItem
} from '../types/chat'
import { encryptedBodyOf, mapServerMessage } from '../utils/messageMapper'
import { EMPTY_MSG_MARKER } from '../utils/messageText'
import { formatRelative, toDateSafe } from '../utils/time'
import { useI18n } from 'vue-i18n'
import { isolate, normalizeUsername } from '../utils/username'

import { useSecureFiles, fileKindOf } from '../features/chat/composables/useSecureFiles'
import type { FileMeta } from '../services/e2ee/messageCodec'
import { usePeerDirectory } from '../features/chat/composables/usePeerDirectory'
import { useConversations, type IncomingMessage } from '../features/chat/composables/useConversations'
import { useOutbox } from '../features/chat/composables/useOutbox'
import { useChatComposer } from '../features/chat/composables/useChatComposer'
import { useMessageSelection } from '../features/chat/composables/useMessageSelection'
import { useMessageContext } from '../features/chat/composables/useMessageContext'
import { useMessageDelete } from '../features/chat/composables/useMessageDelete'
import { useMessageReactions } from '../features/chat/composables/useMessageReactions'
import { useMessageForward } from '../features/chat/composables/useMessageForward'
import { useMessageFiles } from '../features/chat/composables/useMessageFiles'
import { useMessageMedia } from '../features/chat/composables/useMessageMedia'

const showContacts = ref(false)

function resolveReplyPreview(replyId?: string | null): string {
  if (!replyId) return ''

  const same = messages.value.find(m => m.id === replyId || m.clientId === replyId)
  if (same) return previewOf(same)

  const cached = replyPreviewCache[replyId]
  if (cached) return cached

  if (!pendingReplyFetch.has(replyId)) {
    pendingReplyFetch.add(replyId)
    fetchReplyPreview(replyId)
  }
  return t('chat.loadingPreview')
}

const route = useRoute()
const { t, locale } = useI18n()
const router = useRouter()

// The signed-in user lives in the session store, shared with the side menu, profile and settings.
const session = useSessionStore()
const { userId: myId, me: meProfile } = storeToRefs(session)
/** The open chat: a user (`id`, `username`), or a group (`isGroup`, `id` = group id, no username). */
const selectedUser = ref<ChatTarget | null>(null)
const messages = ref<UiMessage[]>([])
const text = ref('')
const outbox = useOutbox({ messages, onError: showSendError })

// End-to-end encryption: this account's identity key, peers' keys, encrypt / decrypt.
const e2ee = useE2eeStore()
const secureFiles = useSecureFiles()

/** Decrypts a message of the conversation with `peerId`. */
function openMessage(raw: string, senderId: string, peerId: string) {
  return e2ee.open(raw, senderId, peerId)
}

/** Short text for a message in replies and previews. */
function previewOf(message: UiMessage): string {
  if (message.cipher && message.cipher !== 'ok' && !(message.cipher === 'legacy' && message.fileUrl)) {
    return t('e2ee.unreadablePreview')
  }
  return message.plainText || (message.fileUrl ? (message.file?.name || t('common.media')) : '—')
}

/** Toast for a send, edit or forward that failed (e.g. the peer has no key yet). */
function showSendError(error: unknown) {
  showToast(getErrorMessage(error))
}

const isPeerTyping = ref(false)
/** Who is typing in the open group. */
const typingName = ref('')
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

const {
  onlineIds,
  lastSeenMap,
  hiddenLastSeen,
  avatarById,
  displayById,
  cachePeerUser,
  ensurePeerCached,
  markOnline,
  markOffline,
  setOnlineSnapshot,
  setLastSeen,
  hidePresence,
  resetPeers
} = usePeerDirectory({ conversations })

const {
  setConversations,
  updateConversationAfterSend,
  upsertIncomingConversation,
  updateIncomingPreview,
  refreshConversationPreview
} = useConversations({
  conversations,
  selectedUser,
  peers: { displayById, avatarById, ensurePeerCached },
  openMessage,
  groupLabels: {
    sender: (groupId, senderId) => (!senderId || senderId === myId.value ? t('groups.you') : memberLabel(groupId, senderId)),
    systemText: (groupId, actorId, event) => describeSystemEvent(event, actorId, id => memberLabel(groupId, id, true))
  }
})



const toast = reactive({ show: false, text: '' })

const menuOpen = ref(false)
const showProfile = ref(false)
const showSettings = ref(false)
const showNewGroup = ref(false)
const showGroupInfo = ref(false)
const groups = useGroupsStore()

type ChatTarget = {
  id: string
  username: string
  isGroup?: boolean
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
let pageAlive = false

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

/** The chat with oneself works as Saved Messages: a private notebook, not a conversation. */
const isSavedChat = computed(() => !!selectedUser.value && !!myId.value && selectedUser.value.id === myId.value)

const selectedLabel = computed(() => {
  const su = selectedUser.value
  if (!su) return ''
  if (isSavedChat.value) return t('menu.savedMessages')
  const conv = conversations.value.find(c => c.peerId === su.id)
  if (su.isGroup) return groups.details[su.id]?.title || conv?.displayName || ''
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





const peerStatus = computed(() => {
  const su = selectedUser.value
  if (!su) return ''
  if (isSavedChat.value) return ''
  if (su.isGroup) {
    if (isPeerTyping.value && typingName.value) return t('groups.typing', { name: typingName.value })
    const members = groups.details[su.id]?.members ?? []
    const online = members.filter(m => m.userId !== myId.value && onlineIds.has(m.userId)).length
    if (!members.length) return ''
    return online
      ? t('groups.membersOnline', { n: members.length, online })
      : t('groups.membersCount', { n: members.length })
  }
  if (isPeerTyping.value) return t('chat.isTyping')
  if (onlineIds.has(su.id)) return t('chat.online')
  if (hiddenLastSeen.has(su.id)) return t('chat.lastSeenRecently')
  const ls = lastSeenMap[su.id]
  return ls ? t('chat.lastSeen', { when: formatRelative(ls) }) : t('chat.lastSeenUnknown')
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

function resetState() {
  chatSessionId++
  resetPeers()
  groups.reset()

  conversations.value = []
  messages.value = []
  selectedUser.value = null

  loadingConversation.value = false
  loadingOlder.value = false
  hasMore.value = true
  oldestId.value = null

  clearPeerTyping()

  text.value = ''
  resetMessageContext()
  cancelFileSend()
  cancelMediaSend()
  outbox.reset()
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
  file?: FileMeta | null
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
    file: input.file ?? null,
    cipher: 'ok',
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

function onConvDblClick(conv: UiConversation) {
  if (selectedUser.value?.id === conv.peerId) {
    scrollToEndSmooth()
    return
  }

  void selectConversation(conv)
}






function openImage(msg: UiMessage){
  viewerImageSrc.value = secureFiles.mediaSrc(msg) || ''
  viewerCaption.value = msg.plainText || ''
  showImageViewer.value = true
}
function openVideo(msg: UiMessage){
  playerVideoSrc.value = secureFiles.mediaSrc(msg) || ''
  playerCaption.value = msg.plainText || ''
  showVideoPlayer.value = true
}


function isNearBottom(el: HTMLElement, threshold = 400) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

async function openPeerProfile() {
  if (!selectedUser.value) return

  if (selectedUser.value.isGroup) {
    showGroupInfo.value = true
    return
  }

  // Saved Messages has no profile to show.
  if (isSavedChat.value) return

  await openUserProfile(selectedUser.value.username)
}

/** The profile of any user (a peer, or a group member). */
async function openUserProfile(username?: string | null) {
  if (!username) return

  const user = await getUserByUsername(
    username.replace(/^@/, '')
  )

  cachePeerUser(user)
  peerProfile.value = user

  try {
    myContacts.value = await getMyContacts()
  } catch {}

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
  showToast(t('chat.contactCopied'))
}








async function fetchReplyPreview(id: string) {
  try {
    const dto = await getMessageBrief(id)
    replyPreviewCache[id] = await briefPreview(dto)
  } catch {
    replyPreviewCache[id] = t('common.unknown')
  } finally {
    pendingReplyFetch.delete(id)
  }
}


async function briefPreview(dto: Awaited<ReturnType<typeof getMessageBrief>>): Promise<string> {
  const peerId = selectedUser.value?.id
  if (!peerId) return ''

  const opened = await openMessage(dto.encryptedContent || '', dto.senderId, peerId)
  if (opened.state !== 'ok') return dto.fileUrl && opened.state === 'legacy' ? t('common.media') : t('e2ee.unreadablePreview')

  const text = opened.envelope.text
  if (text && text !== EMPTY_MSG_MARKER) return text
  return opened.envelope.file?.name || (dto.fileUrl ? t('common.media') : '—')
}

function currentChatRef(): ChatTarget | null {
  const user = selectedUser.value
  if (!user) return null

  return {
    id: user.id,
    username: normalizeUsername(user.username),
    isGroup: user.isGroup
  }
}

function routeUsername(value: unknown) {
  return typeof value === 'string'
    ? normalizeUsername(value)
    : ''
}

async function replaceChatRoute(chat?: ChatTarget | null) {
  const target = chat?.isGroup
    ? `/g/${chat.id}`
    : chat?.username
      ? `/u/${encodeURIComponent(normalizeUsername(chat.username))}`
      : '/chat'

  if (route.path !== target) {
    await router.replace(target)
  }
}

async function openChat(user: ChatTarget, options: OpenChatOptions = {}) {
  const target: ChatTarget = {
    id: String(user.id),
    username: normalizeUsername(user.username),
    isGroup: !!user.isGroup
  }

  if (!target.id || (!target.username && !target.isGroup)) return

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
    await replaceChatRoute(target)
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

    cachePeerUser(user)

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

    showToast(t('chat.usernameNotFound'))
    await replaceChatRoute(null)
  }
}
/** Opens the group in the route (/g/:groupId). */
async function syncGroupFromRoute(value: unknown) {
  const requestId = ++routeSyncRequestId
  const groupId = typeof value === 'string' ? value : ''
  if (!groupId || selectedUser.value?.id === groupId) return

  const group = await groups.load(groupId)
  if (requestId !== routeSyncRequestId) return

  if (!group) {
    showToast(t('groups.notFound'))
    await replaceChatRoute(null)
    return
  }

  ensureGroupConversation(group)
  await openChat({ id: group.id, username: '', isGroup: true }, { resetStack: true, syncRoute: false })
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
      showToast(t('chat.usernameNotFound'))
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
    showToast(t('chat.usernameNotFound'))
  }
}

async function onOpenChatFromContacts(user: ChatTarget) {
  showContacts.value = false

  await openChat(user, {
    resetStack: true
  })
}

function onMenuAction(a: 'profile'|'contacts'|'saved'|'settings'|'newGroup') {
  menuOpen.value = false
  if (a === 'newGroup') {
    void openNewGroup()
  } else if (a === 'profile') {
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


function showToast(message: string) {
  toast.text = message
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
  sealAndSend: e2ee.sealAndSend,
  onForwardError: showSendError,
  appendOutgoingMessage,
  updateConversationAfterSend,

  openUserChat: user =>
    openChat(user, {
      pushCurrent: true
    }),

  outbox
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
  downloadFile,
  sendVoice
} = useMessageFiles({
  selectedUser,
  replyingTo,
  sealAndSend: e2ee.sealAndSend,
  secureFiles,
  onFileError: showSendError,
  appendOutgoingMessage,
  updateConversationAfterSend,
  outbox
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
  sealAndSend: e2ee.sealAndSend,
  secureFiles,
  onMediaError: showSendError,
  appendOutgoingMessage,
  updateConversationAfterSend,
  outbox
})

// Blocking, link previews, search and pins.
const blocks = useBlocksStore()
const mutes = useMutesStore()
const preferences = usePreferencesStore()
const peerBlocked = computed(() => blocks.isBlocked(selectedUser.value?.id))

const linkPreview = useLinkPreview(
  text,
  computed(() => !!selectedUser.value && !editingMessage.value)
)

const search = useMessageSearch({
  messages,
  hasMore,
  loadOlderMessages,
  jumpTo: id => jumpToReplied(id, 60)
})

const pins = usePinnedMessages({
  selectedUser,
  myId,
  openMessage,
  jumpTo: id => jumpToReplied(id, 60),
  onError: showSendError
})

const blockTarget = ref<string | null>(null)
const blocking = ref(false)
const blockTargetName = computed(() =>
  peerProfile.value?.id === blockTarget.value
    ? (peerProfile.value?.displayName || '@' + (peerProfile.value?.username || ''))
    : ''
)

function askBlock(userId: string) {
  blockTarget.value = userId
}

async function confirmBlock() {
  const userId = blockTarget.value
  if (!userId) return
  blocking.value = true
  try {
    await blocks.block(userId)
    markOffline(userId, new Date().toISOString())
    showPeerProfile.value = false
  } catch (error) {
    showSendError(error)
  } finally {
    blocking.value = false
    blockTarget.value = null
  }
}

function onUnblock(userId: string) {
  void blocks.unblock(userId).catch(showSendError)
}

function onSendVoice(recorded: RecordedVoice) {
  void sendVoice(recorded.blob, recorded.mime, recorded.voice)
}

function onVoiceError(error: unknown) {
  console.warn('voice recording failed', error)
  showToast(t('chat.micError'))
}

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
  sealAndSend: e2ee.sealAndSend,
  peerMissingKey: e2ee.peerMissingKey,
  onSendError: showSendError,
  takeLinkPreview: () => linkPreview.take(),
  appendOutgoingMessage,
  updateConversationAfterSend,
  completeEdit,
  outbox
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
  fileKind:fileKindOf,
  mediaSrc:secureFiles.mediaSrc,
  mediaState:secureFiles.mediaState,
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
  },
  retrySend:(message:UiMessage)=>{ void outbox.retry(message) },
  discardFailed:(message:UiMessage)=>outbox.discard(message),
  canRetry:(message:UiMessage)=>outbox.canRetry(message),
  copied:()=>showToast(t('chat.copied')),
  togglePin:(message:UiMessage)=>{ closeMenu(); return pins.toggle(message) },
  isPinned:(message:UiMessage|null)=>pins.isPinned(message)
}

// Encrypted images and videos are downloaded and decrypted as they appear in the chat.
watch(
  () => messages.value.map(message => (message.file ? message.fileUrl : null)),
  () => {
    for (const message of messages.value) secureFiles.ensureMedia(message)
  }
)

// This account's key was replaced on another device and has just been restored here:
// everything on screen was decrypted with the old key, so load it again.
watch(
  () => e2ee.identity?.keyId,
  (current, previous) => {
    if (previous && current && current !== previous && pageAlive) void initializeChatPage()
  }
)

watch(selectedUser, async (current, previous) => {
  // Learn early whether the peer can receive encrypted messages and whether their key changed
  // (for a group: whether any member's key changed).
  if (current?.isGroup) {
    void groups.load(current.id)
    void e2ee.getGroupKeys(current.id).catch(() => {})
  } else if (current) {
    void e2ee.getActivePeerKey(current.id).catch(() => {})
  }

  if (current?.id !== previous?.id) {
    linkPreview.reset()
    search.close()
    pins.reset()
    if (current) void pins.load()
  }

  clearSelection()
  resetReactionUi()
  clearPeerTyping()

  if (previous?.id && previous.id !== current?.id) {
    void stopTyping(previous.id).catch(() => {})
  }

  await nextTick()
  autoGrow(undefined, { animate: false })

  if (!current || current.isGroup) return

  await ensurePeerCached(current.id)

  if (
    onlineIds.has(current.id) ||
    lastSeenMap[current.id]
  ) {
    return
  }

  try {
    const user = await getUserByUsername(
      normalizeUsername(current.username)
    )

    if (selectedUser.value?.id !== current.id) return

    cachePeerUser(user)
  } catch {}
}, { immediate: true })


watch(
  () => route.params.username,
  username => {
    if (!routeSyncReady) return
    void syncChatFromRoute(username)
  }
)

watch(
  () => route.params.groupId,
  groupId => {
    if (!routeSyncReady || !groupId) return
    void syncGroupFromRoute(groupId)
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
  document.addEventListener('visibilitychange', flushPendingReads)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keydown', onKeydownSelection)
  window.addEventListener('scroll', onWindowScroll, true)
  window.addEventListener('resize', onWindowResize)
}

function unregisterPageListeners() {
  document.removeEventListener('visibilitychange', flushPendingReads)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keydown', onKeydownSelection)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', onWindowResize)
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

async function jumpToReplied(replyId: string, maxPages = 5) {
  let el = messageEls.get(replyId)

  if (!el) {
    for (let i = 0; i < maxPages && !el; i++) {
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
      'ring-accent'
    )

    setTimeout(() => {
      el?.classList.remove(
        'ring-2',
        'ring-accent'
      )
    }, 1200)
  } else {
    showToast(t('chat.scrollUpForOlder'))
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

  const prepared = await Promise.all(
    visibleItems.map(async message => {
      const ui = await mapServerMessage(message, {
        myId: myId.value,
        open: (raw, senderId) => openMessage(raw, senderId, userId)
      })

      if (ui.forwardedFromSenderId) {
        void cacheForwardName(ui.forwardedFromSenderId)
      }

      return ui
    })
  )

  if (!isActiveChat(sessionId, userId)) return null

  for (const message of prepared) {
    // Sizes of encrypted attachments are in the message; only old plain files need a HEAD.
    if (!message.fileUrl || message.file) continue

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
      username: conv.username,
      isGroup: conv.isGroup
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

  if (!pageAlive) return

  if (token) {
    session.syncFromToken()

    // Nothing can be read or sent before this device has the account's key.
    await e2ee.init(myId.value)
    if (!pageAlive) return
    await e2ee.whenReady()
    if (!pageAlive) return

    void blocks.load()
    void mutes.load()
    wireSignalR()

    try {
      await connectToChatHub(token)
      if (!pageAlive) return

      const ids = await fetchOnlineUsers()
      if (!pageAlive) return

      setOnlineSnapshot(ids)
      syncPush()
    } catch (error) {
      if (pageAlive) {
        console.warn(
          'initial SignalR connection failed',
          error
        )
      }
    }
  }
  

  try {
    const data = await getConversations()
    if (!pageAlive) return

    await session.loadMe()
    if (!pageAlive) return

    // Member names are needed for the group previews ("Ali: ...").
    await Promise.all((data || []).filter(c => c.isGroup).map(c => groups.load(c.peerId)))
    if (!pageAlive) return

    setConversations(data || [])
    } catch (error) {
      if (pageAlive) {
        console.warn(
          'load conversations failed',
          error
        )
      }
    }
  if (!pageAlive) return
  routeSyncReady = true
  if (route.params.groupId) await syncGroupFromRoute(route.params.groupId)
  else await syncChatFromRoute(route.params.username)

}

onMounted(async () => {
  pageAlive = true

  onWindowResize()
  registerPageListeners()

  await nextTick()
  if (!pageAlive) return

  autoGrow(undefined, { animate: false })

  try {
    await initializeChatPage()
  } catch (error) {
    if (pageAlive) {
      console.error(
        'chat initialization failed',
        error
      )
    }
  }
})

onBeforeUnmount(() => {
  pageAlive = false
  routeSyncReady = false
  routeSyncRequestId++
  chatSessionId++

  resetPeers()
  secureFiles.releaseAll()

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

  signalR.onUserOnline(markOnline)
  signalR.onUserOffline(markOffline)
  signalR.onOnlineSnapshot(setOnlineSnapshot)
  signalR.onUserLastSeen(setLastSeen)
  signalR.onPresenceHidden(hidePresence)
  signalR.onMessageReceived(async rawMessage => {
    const message = rawMessage as IncomingMessage
    const senderId = String(message.senderId ?? message.SenderId ?? '')
    const groupId = String(message.groupId ?? message.GroupId ?? '') || null
    const systemEvent = message.systemEvent ?? message.SystemEvent ?? null

    // My own messages come back only as group service messages ("you added ...").
    if (!senderId || (senderId === myId.value && !systemEvent)) return

    // Messages are filed under their chat: the group, or the sender of a private message.
    const chatId = groupId ?? senderId
    if (groupId) {
      markGroupChat(groupId)
      const group = await groups.load(groupId)
      if (group) ensureGroupConversation(group)
    }

    const active = selectedUser.value?.id === chatId
    const sessionId = chatSessionId

    upsertIncomingConversation(chatId, message, !active && !systemEvent)
    if (!groupId) void ensurePeerCached(senderId)
    if (!systemEvent) void notifyIncoming(chatId, senderId, message, active)

    if (!active) {
      const cipher = encryptedBodyOf(message)
      const conversation = conversations.value.find(item => item.peerId === chatId)
      if (systemEvent && conversation) {
        conversation.lastPreview = describeSystemEvent(systemEvent, senderId, id => memberLabel(chatId, id, true))
      } else if (cipher) {
        void refreshConversationPreview(chatId, cipher, senderId)
      }
      return
    }

    try {
      const ui = await mapServerMessage(message, {
        myId: myId.value,
        open: (raw, from) => openMessage(raw, from, chatId),
        fallbackSentAt: new Date().toISOString()
      })

      if (!isActiveChat(sessionId, chatId)) return

      if (ui.forwardedFromSenderId) {
        void cacheForwardName(ui.forwardedFromSenderId)
      }

      const element = scrollBox.value
      const shouldStick = !!element && isNearBottom(element)

      messages.value.push(ui)
      updateIncomingPreview(chatId, ui)

      if (ui.fileUrl && !ui.file) {
        const key = fileKey(ui)
        if (!fileSizeMap[key]) void ensureFileSize(ui.fileUrl, key)
      }

      await nextTick()

      if (!isActiveChat(sessionId, chatId)) return
      if (element && shouldStick) element.scrollTop = element.scrollHeight

      const messageId = message.messageId ?? message.MessageId ?? message.id
      if (messageId && groupId) markGroupReadWhenVisible(groupId, String(messageId))
      else if (messageId) markReadWhenVisible(String(messageId))
    } catch (error) {
      if (isActiveChat(sessionId, chatId)) {
        console.warn('incoming message failed', error)
      }
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

    // The content is already shown from what was encrypted locally; only the stored URL is new.
    const fileUrl = info.fileUrl ?? info.FileUrl ?? null
    if (fileUrl) {
      m.fileUrl = toAbsoluteFileUrl(fileUrl)
      if (m.clientId && m.fileUrl) secureFiles.adoptServerUrl(m.clientId, m.fileUrl)
      if (!m.file) {
        const k = fileKey(m)
        if (!fileSizeMap[k]) ensureFileSize(m.fileUrl!, k)
      }
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
    const chatId = payload.GroupId || senderId

    // My own typing (another of my devices in Saved Messages) is not shown.
    if (!senderId || senderId === myId.value || chatId !== selectedUser.value?.id) return

    typingName.value = payload.GroupId ? memberLabel(payload.GroupId, senderId) : ''
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
    const chatId = payload.GroupId || senderId

    if (!senderId || chatId !== selectedUser.value?.id) return

    clearPeerTyping()
  })

  signalR.onMessageEdited(async (p) => {
    const m = messages.value.find(x => x.id === p.messageId)
    if (!m) return
    try {
      const partnerId = selectedUser.value?.id
      if (!partnerId) return
      const opened = await openMessage(p.encryptedContent, m.senderId, partnerId)
      if (opened.state === 'ok') {
        const edited = opened.envelope.text
        m.plainText = edited && edited !== EMPTY_MSG_MARKER ? edited : ''
        m.cipher = 'ok'
      } else {
        m.plainText = ''
        m.cipher = opened.state
      }
      m.updatedAtUtc = p.updatedAtUtc || new Date().toISOString()
    } catch (e) {
      console.warn('decrypt edited failed', e)
    }
  })

  signalR.onMessageDeleted((p) => {
    pins.forget(p.messageId)
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

  signalR.onPinsChanged(payload => pins.onPinsChanged(payload))
  signalR.onMutesChanged(payload => mutes.apply(String(payload.chatId), payload.muted))
  signalR.onGroupUpdated(payload => { void onGroupUpdated(payload.groupId) })
  signalR.onGroupRemoved(payload => { void onGroupGone(payload.groupId) })
  signalR.onGroupRead(payload => {
    if (payload.readerId === myId.value) {
      // Read on another of my devices.
      const conversation = conversations.value.find(item => item.peerId === payload.groupId)
      if (conversation) conversation.unreadCount = 0
      void clearChatNotifications(chatTag(payload.groupId))
      return
    }
    if (selectedUser.value?.id !== payload.groupId) return
    // Server times may come without a zone; toDateSafe reads them as UTC.
    const upTo = toDateSafe(payload.readUpToUtc)?.getTime() ?? 0
    for (const message of messages.value) {
      if (message.senderId === myId.value && message.status === 'delivered' && (toDateSafe(message.sentAt)?.getTime() ?? Infinity) <= upTo) {
        message.status = 'read'
      }
    }
  })
  signalR.onSessionTerminated(() => { void onSessionTerminated() })
  signalR.onBlockListChanged(() => { void blocks.load() })

  signalR.onIdentityKeyChanged(payload => {
    void e2ee.onIdentityKeyChanged(String(payload.userId), String(payload.keyId))
  })

  signalR.onReactionUpdated(
    handleReactionUpdated
  )
  }

// ---------------- Notifications, muted chats, read receipts ----------------

/** Same tag as push notifications from the server, so one chat never shows two notifications. */
function chatTag(chatId: string) {
  return 'chat-' + chatId.replace(/-/g, '')
}

async function toggleMute() {
  const id = selectedUser.value?.id
  if (!id) return
  try {
    await mutes.toggle(id)
  } catch (error) {
    showSendError(error)
  }
}

/** Keeps this browser's push subscription in line with the notification settings. */
function syncPush() {
  void syncPushSubscription({
    enabled: preferences.prefs.notifications,
    showSender: preferences.prefs.notificationPreview,
    lang: locale.value === 'en' ? 'en' : 'fa'
  }).catch(error => console.warn('push subscription failed', error))
}

watch([() => preferences.prefs.notifications, () => preferences.prefs.notificationPreview, locale], () => {
  if (pageAlive) syncPush()
})

/**
 * Sound for a message outside the open chat; a system notification as well while the page is
 * hidden. Muted chats stay silent.
 */
async function notifyIncoming(chatId: string, senderId: string, message: IncomingMessage, active: boolean) {
  const prefs = preferences.prefs
  if (!prefs.notifications || mutes.isMuted(chatId)) return
  const isGroup = chatId !== senderId

  const visible = document.visibilityState === 'visible'
  if (visible && active) return
  if (prefs.notificationSound) playNotificationSound()
  if (visible) return

  const meta = isGroup ? null : await ensurePeerCached(senderId)
  const username = meta?.username || ''
  let title = 'PhiChat'
  let body = t('chat.newMessage')

  if (prefs.notificationPreview) {
    title = isGroup
      ? groups.details[chatId]?.title || title
      : displayById[senderId] || meta?.displayName || (username ? '@' + username : title)
    const cipher = encryptedBodyOf(message)
    if (cipher) {
      try {
        const opened = await openMessage(cipher, senderId, chatId)
        if (opened.state === 'ok') {
          const text = opened.envelope.text && opened.envelope.text !== EMPTY_MSG_MARKER ? opened.envelope.text : ''
          body = previewText({ plainText: text, fileUrl: message.fileUrl ?? null, file: opened.envelope.file ?? null }) || body
        }
      } catch {}
    }
    if (isGroup) body = `${isolate(memberLabel(chatId, senderId))}: ${body}`
  }

  await showMessageNotification({
    title,
    body,
    tag: chatTag(chatId),
    url: isGroup ? `/g/${chatId}` : username ? `/u/${username}` : '/chat'
  })
}

/** Read receipts go out only while the chat is actually visible; otherwise they wait for the user to come back. */
const pendingReads = new Set<string>()

function markReadWhenVisible(messageId: string) {
  if (document.visibilityState === 'visible') void markAsRead(messageId).catch(() => {})
  else pendingReads.add(messageId)
}

/** Newest message to mark as read per group, waiting for the page to become visible. */
const pendingGroupReads = new Map<string, string>()

function markGroupReadWhenVisible(groupId: string, messageId: string) {
  if (document.visibilityState === 'visible') void markGroupRead(groupId, messageId).catch(() => {})
  else pendingGroupReads.set(groupId, messageId)
}

function flushPendingReads() {
  if (document.visibilityState !== 'visible') return
  const ids = [...pendingReads]
  pendingReads.clear()
  ids.forEach(id => void markAsRead(id).catch(() => {}))
  for (const [groupId, messageId] of pendingGroupReads) void markGroupRead(groupId, messageId).catch(() => {})
  pendingGroupReads.clear()
  if (selectedUser.value) void clearChatNotifications(chatTag(selectedUser.value.id))
}

/** This session was ended from another device: sign out here and forget the encryption key. */
async function onSessionTerminated() {
  pageAlive = false
  try { await disconnectFromChatHub() } catch {}
  await logout()
  session.reset()
  e2ee.resetState()
  mutes.reset()
  groups.reset()
  await router.replace({ path: '/login', query: { ended: '1' } })
}

// ---------------- Groups ----------------

/** A member's name in a group ("you" for me when `youForMe`); also works for people who left. */
function memberLabel(groupId: string, userId: string, youForMe = false): string {
  if (youForMe && userId === myId.value) return t('groups.you')
  // Current members, then people seen in the group before (e.g. removed), then the peer directory.
  const member = groups.member(groupId, userId) ?? groups.known(userId)
  if (member) return member.displayName || '@' + member.username
  if (!displayById[userId]) void ensurePeerCached(userId)
  return displayById[userId] || conversations.value.find(c => c.peerId === userId)?.displayName || t('common.unknown')
}

/** Sender names on incoming messages and service message texts in the open group. */
const groupRendering = computed(() => {
  const chat = selectedUser.value
  if (!chat?.isGroup) return null
  const groupId = chat.id
  return {
    senderName: (userId: string) => memberLabel(groupId, userId),
    senderColor: (userId: string) => colorFromString(userId),
    systemText: (message: UiMessage) => describeSystemEvent(message.systemEvent, message.senderId, id => memberLabel(groupId, id, true))
  }
})

/** Members of the open group whose encryption key changed since we last saw it. */
const changedMembers = computed(() => {
  const chat = selectedUser.value
  if (!chat?.isGroup) return []
  return (groups.details[chat.id]?.members ?? []).filter(m => m.userId !== myId.value && e2ee.keyChanged[m.userId])
})

const changedMemberNames = computed(() => changedMembers.value.map(m => m.displayName || '@' + m.username).join(', '))

async function acknowledgeKeyChange() {
  const chat = selectedUser.value
  if (!chat) return
  if (!chat.isGroup) {
    await e2ee.trustPeerKey(chat.id, false)
    return
  }
  await Promise.all(changedMembers.value.map(m => e2ee.trustPeerKey(m.userId, false)))
}

/** Adds the group to the chat list if it is not there yet (e.g. we were just added). */
function ensureGroupConversation(group: GroupDetails) {
  markGroupChat(group.id)
  displayById[group.id] = group.title
  avatarById[group.id] = group.avatarUrl ?? null

  const existing = conversations.value.find(item => item.peerId === group.id)
  if (existing) {
    existing.displayName = group.title
    existing.avatarUrl = group.avatarUrl ?? null
    existing.memberCount = group.members.length
    return
  }

  conversations.value.unshift({
    peerId: group.id,
    isGroup: true,
    memberCount: group.members.length,
    username: '',
    displayName: group.title,
    avatarUrl: group.avatarUrl ?? null,
    unreadCount: 0,
    lastSentAt: new Date().toISOString(),
    lastFileUrl: null,
    lastPreview: null
  })
}

async function onGroupUpdated(groupId: string) {
  // Members may have changed: the next message must be encrypted for the new list.
  e2ee.invalidateGroupKeys(groupId)
  const group = await groups.load(groupId, true)
  if (group) ensureGroupConversation(group)
  else await onGroupGone(groupId)
}

/** We left, were removed, or the group was deleted. */
async function onGroupGone(groupId: string) {
  groups.forget(groupId)
  e2ee.invalidateGroupKeys(groupId)
  conversations.value = conversations.value.filter(item => item.peerId !== groupId)
  if (selectedUser.value?.id === groupId) {
    showGroupInfo.value = false
    await closeChat()
  }
}

async function onLeftGroup(groupId: string) {
  showGroupInfo.value = false
  await onGroupGone(groupId)
}

/** People to put in a group: contacts and private-chat partners. */
const groupCandidates = computed<PickablePerson[]>(() => {
  const people = new Map<string, PickablePerson>()
  for (const contact of myContacts.value) {
    const id = String(contact.contactId ?? contact.userId ?? contact.id ?? '')
    if (id && id !== myId.value) people.set(id, { id, username: contact.username, displayName: contact.displayName, avatarUrl: contact.avatarUrl })
  }
  for (const conversation of conversations.value) {
    if (conversation.isGroup || conversation.peerId === myId.value || people.has(conversation.peerId) || !conversation.username) continue
    people.set(conversation.peerId, {
      id: conversation.peerId,
      username: conversation.username,
      displayName: displayById[conversation.peerId] ?? conversation.displayName,
      avatarUrl: avatarById[conversation.peerId] ?? conversation.avatarUrl
    })
  }
  return [...people.values()]
})

async function openNewGroup() {
  try {
    myContacts.value = await getMyContacts()
  } catch {}
  showNewGroup.value = true
}

async function onGroupCreated(group: GroupDetails) {
  showNewGroup.value = false
  groups.set(group)
  ensureGroupConversation(group)
  await openChat({ id: group.id, username: '', isGroup: true }, { resetStack: true })
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

    unreadIds.forEach(markReadWhenVisible)

    // In a group, reading the newest unread message moves my read position past all of them.
    if (user.isGroup) {
      const newest = [...page.source].reverse().find(message =>
        !serverMessageIsDeleted(message) &&
        serverSenderId(message) !== myId.value &&
        serverMessageIsUnread(message))
      const newestId = newest ? serverMessageId(newest) : ''
      if (newestId) markGroupReadWhenVisible(user.id, newestId)
    }
    void clearChatNotifications(chatTag(user.id))
  } catch (error) {
    if (isActiveChat(sessionId, user.id)) {
      console.warn('load conversation failed', error)
      showToast(t('chat.loadFailed'))
    }
  } finally {
    if (isActiveChat(sessionId, user.id)) {
      loadingConversation.value = false
    }
  }
}


function toAbsoluteFileUrl(url: string | null): string | null {
  return url ? toAbsoluteServerUrl(url) : null
}
</script>
