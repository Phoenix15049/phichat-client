<template>
  <div :class="inModal ? '' : 'max-w-2xl mx-auto p-4'">
    <!-- Search and sort -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="w-4 h-4 text-muted absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
        <input v-model="q" type="search" dir="auto" :placeholder="$t('contacts.search')" class="input w-full !ps-9" />
      </div>
      <button
        type="button"
        class="w-10 h-10 shrink-0 grid place-items-center rounded-xl ring-1 transition"
        :class="sortAlpha ? 'ring-accent text-accent bg-accent/10' : 'ring-line text-muted hover:text-ink'"
        :aria-pressed="sortAlpha"
        :title="$t('contacts.sortAz')"
        :aria-label="$t('contacts.sortAz')"
        @click="sortAlpha = !sortAlpha"
      >
        <ArrowDownAZ class="w-4 h-4" />
      </button>
    </div>

    <!-- Add -->
    <button type="button" class="row w-full mt-3 text-accent" @click="openAdd" v-ripple>
      <span class="avatar bg-accent/15"><UserPlus class="w-5 h-5" /></span>
      <span class="font-medium">{{ $t('contacts.add') }}</span>
      <span class="ms-auto text-xs text-muted">{{ $t('contacts.count', { count: contacts.length }, contacts.length) }}</span>
    </button>

    <div class="my-2 border-t border-line"></div>

    <!-- List -->
    <TransitionGroup name="list-fade" tag="ul" class="max-h-[48vh] overflow-y-auto -mx-1 px-1">
      <li v-for="c in filteredContacts" :key="c.contactId" class="row group">
        <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-start" @click="openChat(c)">
          <img v-if="c.avatarUrl" :src="c.avatarUrl" class="avatar object-cover" alt="" />
          <span v-else class="avatar text-white text-sm font-semibold" :style="{ backgroundColor: colorFromString(c.displayName || c.username) }">
            {{ initialsOf(c.displayName || c.username) }}
          </span>
          <span class="min-w-0">
            <span class="block font-medium text-ink truncate"><bdi>{{ c.displayName || '@' + handle(c) }}</bdi></span>
            <span class="block text-[13px] text-muted truncate" dir="ltr">@{{ handle(c) }}</span>
          </span>
        </button>

        <div class="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button type="button" class="icon-btn w-9 h-9 hover:!text-accent" :title="$t('contacts.chat')" :aria-label="$t('contacts.chat')" @click="openChat(c)">
            <MessageSquare class="w-[18px] h-[18px]" />
          </button>
          <button type="button" class="icon-btn w-9 h-9 hover:!text-danger" :title="$t('common.remove')" :aria-label="$t('common.remove')" @click="removing = c">
            <Trash2 class="w-[18px] h-[18px]" />
          </button>
        </div>
      </li>
    </TransitionGroup>

    <!-- Nothing to show -->
    <div v-if="!filteredContacts.length" class="py-8 flex flex-col items-center gap-2 text-center">
      <span class="w-14 h-14 grid place-items-center rounded-[35%] bg-accent/10 text-accent"><UsersRound class="w-7 h-7" /></span>
      <p class="text-sm font-medium text-ink">{{ q ? $t('contacts.noResults') : $t('contacts.empty') }}</p>
      <p v-if="!q" class="text-[13px] text-muted max-w-[18rem]">{{ $t('contacts.emptyHint') }}</p>
    </div>
  </div>

  <!-- Add contact -->
  <ModalSheet narrow :open="showAdd" @close="showAdd = false">
    <form class="p-5" @submit.prevent="onAdd">
      <div class="flex items-start gap-3 mb-4">
        <span class="w-11 h-11 shrink-0 grid place-items-center rounded-[35%] bg-accent/15 text-accent"><UserPlus class="w-5 h-5" /></span>
        <div class="flex-1 min-w-0">
          <h2 class="text-[17px] font-bold text-ink leading-6">{{ $t('contacts.add') }}</h2>
          <p class="text-[13px] text-muted">{{ $t('contacts.addHint') }}</p>
        </div>
        <button type="button" class="icon-btn w-8 h-8 -mt-1 -me-1" :aria-label="$t('common.close')" @click="showAdd = false">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="relative" dir="ltr">
        <AtSign class="w-4 h-4 text-muted absolute top-1/2 -translate-y-1/2 left-3 pointer-events-none" />
        <input
          ref="usernameInput"
          v-model="usernameToAdd"
          dir="ltr"
          autocomplete="off"
          spellcheck="false"
          class="input w-full !pl-9"
          :placeholder="$t('contacts.usernamePlaceholder').replace('@', '')"
        />
      </div>

      <!-- What the username leads to -->
      <div class="mt-3 min-h-[60px] flex items-center">
        <div v-if="lookup.state === 'searching'" class="w-full flex justify-center text-muted"><Loader2 class="w-5 h-5 animate-spin" /></div>

        <div v-else-if="lookup.state === 'found' && lookup.user" class="w-full flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
          <img v-if="lookup.user.avatarUrl" :src="lookup.user.avatarUrl" class="avatar object-cover" alt="" />
          <span v-else class="avatar text-white text-sm font-semibold" :style="{ backgroundColor: colorFromString(lookup.user.displayName || lookup.user.username) }">
            {{ initialsOf(lookup.user.displayName || lookup.user.username) }}
          </span>
          <span class="flex-1 min-w-0">
            <span class="block font-medium text-ink truncate"><bdi>{{ lookup.user.displayName || '@' + lookup.user.username }}</bdi></span>
            <span class="block text-[13px] truncate" :class="blockedReason ? 'text-muted' : 'text-accent'">
              {{ blockedReason || '@' + lookup.user.username }}
            </span>
          </span>
          <Check v-if="!blockedReason" class="w-5 h-5 text-accent shrink-0" />
        </div>

        <p v-else-if="lookup.state === 'missing'" class="w-full text-center text-[13px] text-danger">{{ $t('contacts.notFound') }}</p>
        <p v-else class="w-full text-center text-[13px] text-muted">{{ $t('contacts.lookupHint') }}</p>
      </div>

      <p v-if="addError" class="mt-1 text-[13px] text-danger text-center">{{ addError }}</p>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button type="button" class="btn-outline justify-center" @click="showAdd = false">{{ $t('common.cancel') }}</button>
        <button class="btn-primary" :disabled="!canAdd || adding">
          {{ adding ? $t('contacts.adding') : $t('common.add') }}
        </button>
      </div>
    </form>
  </ModalSheet>

  <ConfirmDialog
    :open="!!removing"
    :title="$t('contacts.removeTitle')"
    :message="$t('contacts.removeConfirm', { name: removing?.displayName || '@' + (removing ? handle(removing) : '') })"
    :confirm-label="$t('common.remove')"
    danger
    :busy="removeBusy"
    @cancel="removing = null"
    @confirm="onRemove"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownAZ, AtSign, Check, Loader2, MessageSquare, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { colorFromString, initialsOf } from '../utils/avatar'
import { addContact, getErrorMessage, getMyContacts, getUserByUsername, removeContact } from '../services/api'
import { useSessionStore } from '../stores/session'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ModalSheet from '../components/ModalSheet.vue'
import type { Contact, UserApiItem } from '../types/chat'

defineProps<{ inModal?: boolean }>()
const emit = defineEmits<{ (e: 'open-chat', p: { id: string; username: string }): void }>()

const { t } = useI18n()
const session = useSessionStore()

const contacts = ref<Contact[]>([])
const q = ref('')
const sortAlpha = ref(false)

onMounted(load)
async function load() {
  contacts.value = await getMyContacts()
}

const handle = (c: Contact) => (c.username || '').replace(/^@/, '')

const filteredContacts = computed(() => {
  const s = q.value.trim().replace(/^@/, '').toLowerCase()
  let list = !s
    ? contacts.value
    : contacts.value.filter(c => (c.displayName || '').toLowerCase().includes(s) || (c.username || '').toLowerCase().includes(s))
  if (sortAlpha.value) {
    list = [...list].sort((a, b) => (a.displayName || a.username || '').localeCompare(b.displayName || b.username || ''))
  }
  return list
})

function openChat(c: Contact) {
  const id = c.userId || c.id || c.contactUserId || c.peerId || c.contactId
  const username = handle(c)
  if (id && username) emit('open-chat', { id, username })
}

// ---------- adding ----------

const showAdd = ref(false)
const usernameToAdd = ref('')
const usernameInput = ref<HTMLInputElement | null>(null)
const adding = ref(false)
const addError = ref('')
const lookup = reactive<{ state: 'idle' | 'searching' | 'found' | 'missing'; user: UserApiItem | null }>({ state: 'idle', user: null })

let lookupTimer: number | null = null
let lookupSeq = 0

async function openAdd() {
  usernameToAdd.value = ''
  addError.value = ''
  showAdd.value = true
  await nextTick()
  usernameInput.value?.focus()
}

/** Looks the name up shortly after typing stops, so the user sees who they are about to add. */
watch(usernameToAdd, value => {
  const username = value.trim().replace(/^@/, '')
  const seq = ++lookupSeq
  addError.value = ''
  if (lookupTimer !== null) window.clearTimeout(lookupTimer)

  lookup.user = null
  if (username.length < 3) {
    lookup.state = 'idle'
    return
  }

  lookup.state = 'searching'
  lookupTimer = window.setTimeout(async () => {
    try {
      const user = await getUserByUsername(username)
      if (seq !== lookupSeq) return
      lookup.user = user
      lookup.state = user?.id ? 'found' : 'missing'
    } catch {
      if (seq === lookupSeq) lookup.state = 'missing'
    }
  }, 350)
})

onBeforeUnmount(() => {
  if (lookupTimer !== null) window.clearTimeout(lookupTimer)
})

const blockedReason = computed(() => {
  const user = lookup.user
  if (!user) return ''
  if (user.id === session.userId) return t('contacts.thatsYou')
  return contacts.value.some(c => c.contactId === user.id) ? t('contacts.alreadyAdded') : ''
})

const canAdd = computed(() => lookup.state === 'found' && !blockedReason.value)

async function onAdd() {
  const user = lookup.user
  if (!user || !canAdd.value) return

  adding.value = true
  addError.value = ''
  try {
    await addContact(user.id)
    showAdd.value = false
    await load()
  } catch (error) {
    addError.value = getErrorMessage(error)
  } finally {
    adding.value = false
  }
}

// ---------- removing ----------

const removing = ref<Contact | null>(null)
const removeBusy = ref(false)

async function onRemove() {
  const contact = removing.value
  if (!contact) return

  removeBusy.value = true
  try {
    await removeContact(contact.contactId)
    await load()
  } catch (error) {
    console.warn('remove contact failed', error)
  } finally {
    removeBusy.value = false
    removing.value = null
  }
}
</script>

<style scoped>
@reference "../assets/tailwind.css";

.row {
  @apply relative overflow-hidden flex items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-surface-2 transition-colors;
}
.avatar {
  @apply w-10 h-10 shrink-0 rounded-[35%] grid place-items-center;
}

.list-fade-enter-from { opacity: 0; transform: translateY(4px); }
.list-fade-leave-to { opacity: 0; transform: translateY(-4px); }
.list-fade-enter-active,
.list-fade-leave-active { transition: opacity .16s ease, transform .16s ease; }
</style>
