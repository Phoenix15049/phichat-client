<template>
  <div class="max-w-2xl mx-auto p-4 space-y-4" dir="ltr">
    <h1 class="text-xl font-bold text-[#1B3C59]"></h1>

    <!-- Search + sort + count -->
    <div class="flex items-center gap-2">
      <input
        v-model="q"
        placeholder="Search contacts…"
        class="input flex-1"
      />

      <button
        class="btn-outline flex items-center gap-1"
        :aria-pressed="sortAlpha"
        @click="sortAlpha = !sortAlpha"
        title="Sort A–Z"
        v-ripple
      >
        <span class="text-sm">{{ sortAlpha ? 'A–Z' : 'A↔Z' }}</span>
      </button>

      <div class="text-xs text-[#456173] whitespace-nowrap">
        {{ filteredContacts.length }} contacts
      </div>
    </div>

    <!-- List -->
    <transition-group name="list-fade" tag="ul" class="divide-y bg-white rounded-xl ring-1 ring-black/5 overflow-hidden">
      <li
        v-for="c in filteredContacts"
        :key="c.contactId"
        class="flex items-center justify-between py-3 px-3 hover:bg-[#11BFAE]/5 transition"
      >
        <div class="flex items-center gap-3 min-w-0">
          <img
            v-if="c.avatarUrl"
            :src="c.avatarUrl"
            class="w-9 h-9 rounded-full object-cover ring-2 ring-[#F2F2F0]"
          />
          <div
            v-else
            class="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold
                   bg-gradient-to-br from-[#456173] to-[#1B3C59]"
          >
            {{ initials(c.displayName || c.username) }}
          </div>

          <div class="flex flex-col min-w-0">
            <span class="font-medium text-[#1B3C59] truncate">@{{ (c.username || '').replace(/^@/, '') }}</span>
            <span v-if="c.displayName" class="text-sm text-[#456173] truncate">{{ c.displayName }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="openChat(c)" class="btn-text" v-ripple>Chat</button>
          <button @click="onRemove(c)" class="btn-danger" v-ripple>Remove</button>
        </div>
      </li>
    </transition-group>

    <p v-if="contacts.length === 0" class="text-sm text-[#456173]">No contacts yet.</p>

    <!-- Sticky add button when embedded as modal content -->
    <div v-if="inModal" class="sticky bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t p-3">
      <button class="btn-primary rounded-full shadow" @click="showAdd = true" v-ripple>
        + Add contact
      </button>
    </div>
  </div>

  <!-- Add contact modal -->
  <ModalSheet :open="showAdd" @close="showAdd=false">
    <div class="p-5 w-[420px] max-w-full" dir="ltr">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-bold text-[#1B3C59]">Add contact</h2>
        <button class="px-2 py-1 rounded text-[#456173] hover:text-[#1B3C59] hover:bg-[#F2F2F0]" @click="showAdd=false" v-ripple>✕</button>
      </div>

      <form class="space-y-3" @submit.prevent="onAdd">
        <input
          v-model="usernameToAdd"
          placeholder="@username"
          class="input w-full"
        />
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn-outline" @click="showAdd=false" v-ripple>Cancel</button>
          <button class="btn-primary" :disabled="!usernameToAdd || adding" v-ripple>
            <span v-if="!adding">Add</span>
            <span v-else>Adding…</span>
          </button>
        </div>
      </form>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getMyContacts, addContact, removeContact, getUserByUsername } from '../services/api'
import ModalSheet from '../components/ModalSheet.vue'

const props = defineProps<{ inModal?: boolean }>()
const emit = defineEmits<{ (e: 'open-chat', p: { id: string; username: string }): void }>()

// state
const contacts = ref<Array<{ contactId: string; username: string; displayName?: string; avatarUrl?: string }>>([])
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

async function onRemove(c: { contactId: string }) {
  try {
    await removeContact(c.contactId)
    await load()
  } catch (e) {
    console.error('remove contact failed', e)
  }
}

function openChat(c: any) {
  const id = c.userId || c.id || c.contactUserId || c.peerId || c.contactId
  const username = (c.username || '').replace(/^@/, '')
  if (!id || !username) return
  emit('open-chat', { id, username })
}

// helpers
function initials(name?: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).slice(0,2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('')
}

// ripple directive (local)
const vRipple = {
  mounted(el: HTMLElement) {
    el.style.position ||= 'relative'
    el.style.overflow ||= 'hidden'
    el.addEventListener('click', (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.1
      const span = document.createElement('span')
      span.className = 'ripple-ink'
      span.style.width = span.style.height = `${size}px`
      span.style.left = `${e.clientX - rect.left - size/2}px`
      span.style.top  = `${e.clientY - rect.top  - size/2}px`
      el.appendChild(span)
      span.addEventListener('animationend', () => span.remove())
    })
  }
}
</script>

<style scoped>
@reference "tailwindcss";

/* palette-based controls (same across app) */
.input {
  @apply border rounded-lg px-3 py-2 outline-none bg-white
         focus:ring-2 focus:ring-[#11BFAE]/60 focus:border-[#11BFAE];
}
.btn-primary {
  @apply bg-[#11BFAE] text-white rounded-lg px-4 py-2 hover:bg-[#10B2A3] transition disabled:opacity-60;
}
.btn-outline {
  @apply border border-[#456173]/40 text-[#1B3C59] rounded-lg px-3 py-2 hover:bg-[#F2F2F0] transition;
}
.btn-text {
  @apply text-[#11BFAE] hover:underline px-2 py-1 rounded;
}
.btn-danger {
  @apply text-red-600 px-2 py-1 rounded hover:bg-red-50;
}

/* list enter/leave */
.list-fade-enter-from { opacity: 0; transform: translateY(4px); }
.list-fade-leave-to   { opacity: 0; transform: translateY(-4px); }
.list-fade-enter-active,
.list-fade-leave-active { transition: opacity .16s ease, transform .16s ease; }

/* ripple (global so dynamic span is styled) */
:global(.ripple-ink) {
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity: .15;
  transform: scale(0);
  pointer-events: none;
  animation: ripple .5s ease-out forwards;
}
@keyframes ripple { to { transform: scale(4); opacity: 0; } }
</style>
