<template>
  <div class="w-64 border-r h-full overflow-y-auto">
    <div
      v-for="user in users"
      :key="user.id"
      @click="selectUser(user)"
      class="p-4 hover:bg-gray-100 cursor-pointer border-b"
      :class="{ 'bg-blue-100': selected?.id === user.id }"
    >
      <div class="flex items-start gap-2">
        <!-- آواتار + دات حضور -->
        <div class="relative w-8 h-8 rounded-full bg-gray-300 shrink-0">
          <span
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white"
            :class="online.has(user.id) ? 'bg-green-500' : 'bg-gray-400'"
          />
        </div>

        <!-- نام کاربر + وضعیت + نخوانده‌ها -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="font-medium truncate">@{{ user.username }}</span>

            <!-- Badge نخوانده‌ها -->
            <span
              v-if="(props.unread?.[user.id] ?? 0) > 0"
              class="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] rounded-full bg-red-600 text-white"
            >
              {{ props.unread[user.id] }}
            </span>
          </div>

          <!-- وضعیت تایپ/حضور -->
          <div class="mt-0.5 text-xs">
            <span v-if="typing.has(user.id)" class="text-gray-500">در حال تایپ…</span>
            <span v-else-if="online.has(user.id)" class="text-green-600">آنلاین</span>
            <span v-else class="text-gray-400" :title="formatAbsoluteFa(lastSeen.get(user.id))">
              آخرین بازدید: {{ formatRelativeFa(lastSeen.get(user.id)) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { formatRelativeFa, formatAbsoluteFa } from '../utils/time'
import { ref, reactive, defineEmits, onMounted } from 'vue'
import { getUserList } from '../services/api'
import { parseJwt } from '../utils/jwt'
import { onOnlineSnapshot, onUserOnline, onUserOffline, onTyping, onTypingStopped, onUserLastSeen } from '../services/signalr'


const props = defineProps<{
  unread: Record<string, number>
}>()

type UiUser = { id: string; username: string; lastSeenUtc?: string | null }

const users = ref<UiUser[]>([])
const selected = ref<UiUser | null>(null)
const emit = defineEmits(['user-selected'])

// Use reactive Set so .has(...) is reactive in template
const online = reactive(new Set<string>())
const typing = reactive(new Set<string>())
const lastSeen = reactive(new Map<string, string>())


const selectUser = (user: UiUser) => {
  selected.value = user
  emit('user-selected', user)
}

onMounted(async () => {
  // Load users and filter myself
  const allUsers = await getUserList()
  const token = localStorage.getItem('token') || ''
  const decoded = parseJwt(token)
  const myId: string =
    decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
  users.value = allUsers.filter((u: UiUser) => u.id !== myId)
  
  for (const u of users.value) {
    if (u.lastSeenUtc) lastSeen.set(u.id, u.lastSeenUtc)
  }

  onOnlineSnapshot((ids) => {
    online.clear()
    ids.forEach(id => online.add(id))
    const nowIso = new Date().toISOString()
    ids.forEach(id => lastSeen.set(id, nowIso))
  })

  onUserOnline((uid) => {
    online.add(uid)
    lastSeen.set(uid, new Date().toISOString())
  })
  onUserOffline((uid, when) => {
    online.delete(uid)
    lastSeen.set(uid, when)
  })

  onUserLastSeen((uid, when) => {
    lastSeen.set(uid, when)
  })

  onTyping((p) => typing.add(p.SenderId))
  onTypingStopped((p) => typing.delete(p.SenderId))


  setInterval(() => {
    users.value = [...users.value]
  }, 60000)
})
</script>

