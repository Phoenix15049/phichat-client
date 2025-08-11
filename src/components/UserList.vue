<template>
  <div class="w-64 border-r h-full overflow-y-auto">
    <div
      v-for="user in users"
      :key="user.id"
      @click="selectUser(user)"
      class="p-4 hover:bg-gray-100 cursor-pointer border-b"
      :class="{ 'bg-blue-100': selected?.id === user.id }"
    >
      <div class="flex items-center gap-2">
    <!-- آواتار/آیکون دلخواه -->
      <div class="w-8 h-8 rounded-full bg-gray-300"></div>
      <div class="flex flex-col">
        <span class="font-medium">@{{ user.username }}</span>
        <!-- اگر displayName داری -->
        <!-- <span v-if="user.displayName" class="text-xs text-gray-500">{{ user.displayName }}</span> -->
      </div>
    </div>

    <!-- Badge نخوانده‌ها -->
    <span
      v-if="(props.unread?.[user.id] ?? 0) > 0"
      class="min-w-6 h-6 px-2 inline-flex items-center justify-center text-xs rounded-full bg-red-600 text-white"
    >
      {{ props.unread[user.id] }}
    </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits, onMounted } from 'vue'
import { getUserList } from '../services/api'
import { parseJwt } from '../utils/jwt'
const props = defineProps<{
  unread: Record<string, number>
}>()

const users = ref<{ id: string; username: string; publicKey: string }[]>([])
const selected = ref<{ id: string; username: string; publicKey: string } | null>(null)
const emit = defineEmits(['user-selected'])

const selectUser = (user: { id: string; username: string; publicKey: string }) => {
  selected.value = user
  emit('user-selected', user)
}

onMounted(async () => {
  const allUsers = await getUserList()

  const token = localStorage.getItem('token') || ''
  const decoded = parseJwt(token)
  const myId = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]

  users.value = allUsers.filter(u => u.id !== myId)
})
</script>
