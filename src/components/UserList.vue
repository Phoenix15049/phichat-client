<template>
  <div class="w-64 border-r h-full overflow-y-auto">
    <div
      v-for="user in users"
      :key="user.id"
      @click="selectUser(user)"
      class="p-4 hover:bg-gray-100 cursor-pointer border-b"
      :class="{ 'bg-blue-100': selected?.id === user.id }"
    >
      {{ user.username }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits, onMounted } from 'vue'
import { getUserList } from '../services/api'
import { parseJwt } from '../utils/jwt'

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
