<template>
  <div class="max-w-2xl mx-auto p-4 space-y-4">

    <!-- Search + sort + count -->
    <div class="flex items-center gap-2">
      <input
        v-model="q"
        :placeholder="$t('contacts.search')"
        class="input flex-1"
      />

      <button class="btn-outline flex items-center gap-1" :aria-pressed="sortAlpha" @click="sortAlpha = !sortAlpha" :title="$t('contacts.sortAz')" v-ripple>
        <ArrowUpAZ v-if="sortAlpha" class="w-4 h-4" />
        <ArrowDownAZ v-else class="w-4 h-4" />
        <span class="sr-only">{{ $t('contacts.sort') }}</span>
      </button>


      <div class="text-xs text-muted whitespace-nowrap">
        {{ $t('contacts.count', { count: filteredContacts.length }, filteredContacts.length) }}
      </div>
    </div>

    <!-- List -->
    <transition-group name="list-fade" tag="ul" class="divide-y bg-surface rounded-xl ring-1 ring-line overflow-hidden">
      <li
        v-for="c in filteredContacts"
        :key="c.contactId"
        class="flex items-center justify-between py-3 px-3 hover:bg-accent/5 transition"
      >
        <div class="flex items-center gap-3 min-w-0">
          <img
            v-if="c.avatarUrl"
            :src="c.avatarUrl"
            class="w-9 h-9 rounded-full object-cover ring-2 ring-canvas"
          />
          <div
            v-else
            class="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold
                   bg-gradient-to-br from-[#456173] to-[#1B3C59]"
          >
            {{ initialsOf(c.displayName || c.username) }}
          </div>

          <div class="flex flex-col min-w-0">
            <span class="font-medium text-ink truncate"><span dir="ltr">@{{ (c.username || '').replace(/^@/, '') }}</span></span>
            <span v-if="c.displayName" class="text-sm text-muted truncate" dir="auto">{{ c.displayName }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="openChat(c)" class="btn-text flex items-center gap-1.5" v-ripple>
            <MessageSquare class="w-4 h-4" /> <span>{{ $t('contacts.chat') }}</span>
          </button>
          <button @click="onRemove(c)" class="btn-danger flex items-center gap-1.5" v-ripple>
            <Trash2 class="w-4 h-4" /> <span>{{ $t('common.remove') }}</span>
          </button>
        </div>

      </li>
    </transition-group>

    <p v-if="contacts.length === 0" class="text-sm text-muted">{{ $t('contacts.empty') }}</p>

    <!-- Sticky add button when embedded as modal content -->
    <div v-if="inModal" class="sticky bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t p-3">
      <button class="btn-primary rounded-full shadow flex items-center gap-2" @click="showAdd = true" v-ripple>
        <UserPlus class="w-4 h-4" /> <span>{{ $t('contacts.add') }}</span>
      </button>
    </div>
  </div>

  <!-- Add contact modal -->
  <ModalSheet :open="showAdd" @close="showAdd=false">
    <div class="p-5 w-[420px] max-w-full">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-bold text-ink">{{ $t('contacts.add') }}</h2>
        <button class="px-2 py-1 rounded text-muted hover:text-ink hover:bg-canvas" @click="showAdd=false" v-ripple :aria-label="$t('common.close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form class="space-y-3" @submit.prevent="onAdd">
        <input
          v-model="usernameToAdd"
          :placeholder="$t('contacts.usernamePlaceholder')"
          dir="ltr"
          class="input w-full"
        />
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn-outline" @click="showAdd=false" v-ripple>{{ $t('common.cancel') }}</button>
          <button class="btn-primary" :disabled="!usernameToAdd || adding" v-ripple>
            <span v-if="!adding">{{ $t('common.add') }}</span>
            <span v-else>{{ $t('contacts.adding') }}</span>
          </button>
        </div>
      </form>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { initialsOf } from '../utils/avatar'
import { X, MessageSquare, Trash2, ArrowUpAZ, ArrowDownAZ, UserPlus } from 'lucide-vue-next'
import { ref, onMounted, computed } from 'vue'
import { getMyContacts, addContact, removeContact, getUserByUsername } from '../services/api'
import ModalSheet from '../components/ModalSheet.vue'
import type { Contact } from '../types/chat'


defineProps<{ inModal?: boolean }>()
const emit = defineEmits<{ (e: 'open-chat', p: { id: string; username: string }): void }>()

// state
const contacts = ref<Contact[]>([])
const usernameToAdd = ref('')
const q = ref('')
const showAdd = ref(false)
const adding = ref(false)
const sortAlpha = ref(false)

// load
onMounted(load)
async function load() {
  contacts.value = await getMyContacts()
}

// computed
const filteredContacts = computed(() => {
  const s = q.value.trim().toLowerCase()
  let arr = !s
    ? contacts.value
    : contacts.value.filter(c => {
        const dn = (c.displayName || '').toLowerCase()
        const un = (c.username || '').toLowerCase()
        return dn.includes(s) || un.includes(s)
      })
  if (sortAlpha.value) {
    arr = [...arr].sort((a, b) =>
      (a.displayName || a.username || '').localeCompare(
        b.displayName || b.username || '',
        'en'
      )
    )
  }
  return arr
})

// actions
async function onAdd() {
  const u = (usernameToAdd.value || '').trim().replace(/^@/, '')
  if (!u) return
  adding.value = true
  try {
    const user = await getUserByUsername(u)
    if (!user?.id) throw new Error('User not found')
    await addContact(user.id)
    usernameToAdd.value = ''
    showAdd.value = false
    await load()
  } catch (e) {
    console.error('add contact failed', e)
  } finally {
    adding.value = false
  }
}

async function onRemove(c: Contact) {
  try {
    await removeContact(c.contactId)
    await load()
  } catch (e) {
    console.error('remove contact failed', e)
  }
}

function openChat(c: Contact) {
  const id = c.userId || c.id || c.contactUserId || c.peerId || c.contactId
  const username = (c.username || '').replace(/^@/, '')
  if (!id || !username) return
  emit('open-chat', { id, username })
}

// helpers

</script>

<style scoped>
@reference "../assets/tailwind.css";

/* palette-based controls (same across app) */
.input {
  @apply border rounded-lg px-3 py-2 outline-none bg-surface
         focus:ring-2 focus:ring-accent/60 focus:border-accent;
}
.btn-primary {
  @apply bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-strong transition disabled:opacity-60;
}
.btn-outline {
  @apply border border-muted/40 text-ink rounded-lg px-3 py-2 hover:bg-canvas transition;
}
.btn-text {
  @apply text-accent hover:underline px-2 py-1 rounded;
}
.btn-danger {
  @apply text-danger px-2 py-1 rounded hover:bg-danger/10;
}

/* list enter/leave */
.list-fade-enter-from { opacity: 0; transform: translateY(4px); }
.list-fade-leave-to   { opacity: 0; transform: translateY(-4px); }
.list-fade-enter-active,
.list-fade-leave-active { transition: opacity .16s ease, transform .16s ease; }

</style>
