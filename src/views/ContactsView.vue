<template>
  <div class="max-w-2xl mx-auto p-4 space-y-4">
    <h1 class="text-xl font-semibold"></h1>

    <div class="flex items-center gap-2">
      <input
        v-model="q"
        placeholder="جست‌وجوی مخاطب…"
        class="flex-1 border rounded px-3 py-2"
      />
      <button
        class="px-2 py-1 text-sm rounded border hover:bg-gray-50"
        :aria-pressed="sortAlpha"
        @click="sortAlpha = !sortAlpha"
        title="مرتب‌سازی الفبایی"
      >
        ⬇
      </button>
      <div class="text-xs text-gray-500 whitespace-nowrap">
        {{ filteredContacts.length }} مخاطب
      </div>
    </div>



    <ul class="divide-y">
      <li
        v-for="c in filteredContacts"
        :key="c.contactId"
        class="flex items-center justify-between py-3"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="c.avatarUrl"
            :src="c.avatarUrl"
            class="w-9 h-9 rounded-full object-cover"
          />
          <div v-else class="w-9 h-9 rounded-full bg-gray-300"></div>

          <div class="flex flex-col">
            <router-link :to="`/u/${c.username}`" class="font-medium hover:underline">
              @{{ c.username }}
            </router-link>
            <span v-if="c.displayName" class="text-sm text-gray-500">{{ c.displayName }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="openChat(c)" class="text-blue-600 hover:underline">چت</button>
          <button @click="onRemove(c)" class="text-red-600 hover:underline">حذف</button>
        </div>
      </li>
    </ul>

    <p v-if="contacts.length === 0" class="text-sm text-gray-500">مخاطبی ثبت نشده.</p>
  </div>
  <div v-if="props.inModal" class="sticky bottom-0 left-0 right-0 bg-white border-t p-3">
    <button
      class="bg-blue-600 text-white px-4 py-2 rounded-full shadow hover:bg-blue-700"
      @click="showAdd = true"
    >
      + افزودن مخاطب
    </button>
  </div>
  
  <div v-if="showAdd" class="fixed inset-0 z-30">
    <div class="absolute inset-0 bg-black/30" @click="showAdd=false"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                bg-white rounded-2xl shadow-xl w-[420px] max-w-[95vw] p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">افزودن مخاطب</div>
        <button class="text-gray-500 hover:text-gray-700" @click="showAdd=false">✕</button>
      </div>

      <form class="space-y-3" @submit.prevent="onAdd">
        <input
          v-model="usernameToAdd"
          placeholder="@username"
          class="w-full border rounded px-3 py-2"
        />
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="px-3 py-2 rounded border" @click="showAdd=false">انصراف</button>
          <button
            class="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            :disabled="!usernameToAdd || adding"
          >
            {{ adding ? 'در حال افزودن…' : 'افزودن' }}
          </button>
        </div>
      </form>
    </div>
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted,computed } from 'vue'
import { getMyContacts, addContact, removeContact } from '../services/api'
import { getUserByUsername } from '../services/api'
import { useRouter } from 'vue-router'



const router = useRouter()
const contacts = ref<Array<{ contactId: string; username: string; displayName?: string; avatarUrl?: string }>>([])
const usernameToAdd = ref('')
const props = defineProps<{ inModal?: boolean }>()

const q = ref('')                 // جست‌وجو
const showAdd = ref(false)        // باز/بستن مودال افزودن
const adding = ref(false) 
const sortAlpha = ref(false)      // مرتب‌سازی الفبایی


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
        'fa'
      )
    )
  }
  return arr
})





onMounted(load)

async function load() {
  contacts.value = await getMyContacts()
}

async function onAdd() {
  const u = (usernameToAdd.value || '').trim().replace(/^@/, '')
  if (!u) return
  adding.value = true
  try {
    const user = await getUserByUsername(u)
    if (!user?.id) throw new Error('کاربر یافت نشد')
    await addContact(user.id)
    usernameToAdd.value = ''
    showAdd.value = false
    await load()
  } catch (e) {
    console.error('add contact failed', e)
    // اگر خواستی پیام کاربرپسند بده:
    // alert('کاربر یافت نشد یا خطایی رخ داد')
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

function openChat(c: { contactId: string; username: string }) {
  router.push(`/u/${c.username}`)
}
</script>