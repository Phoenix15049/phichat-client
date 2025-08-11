<template>
  <div class="max-w-2xl mx-auto p-4 space-y-4">
    <h1 class="text-xl font-semibold">مخاطبین</h1>

    <form class="flex gap-2" @submit.prevent="onAdd">
      <input v-model="usernameToAdd" placeholder="@username" class="flex-1 border rounded px-3 py-2" />
      <button class="bg-blue-600 text-white px-4 py-2 rounded">افزودن</button>
    </form>

    <ul class="divide-y">
      <li
        v-for="c in contacts"
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
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMyContacts, addContact, removeContact } from '../services/api'
import { getUserByUsername } from '../services/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const contacts = ref<Array<{ contactId: string; username: string; displayName?: string; avatarUrl?: string }>>([])
const usernameToAdd = ref('')

onMounted(load)

async function load() {
  contacts.value = await getMyContacts()
}

async function onAdd() {
  const u = usernameToAdd.value.trim().replace(/^@/, '')
  if (!u) return
  try {
    const resolved = await getUserByUsername(u) // returns { id, username, ... }
    await addContact(resolved.id)
    usernameToAdd.value = ''
    await load()
  } catch (e) {
    console.error('add contact failed', e)
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