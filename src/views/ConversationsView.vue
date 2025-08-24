<template>
  <div class="max-w-2xl mx-auto p-4 space-y-3">
    <h1 class="text-xl font-semibold">گفتگوها</h1>

    <div v-if="loading" class="text-sm text-gray-500">در حال بارگذاری…</div>

    <ul class="divide-y">
      <li
        v-for="c in items"
        :key="c.peerId"
        class="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded"
        @click="openChat(c)"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="c.peerAvatarUrl"
            :src="c.peerAvatarUrl"
            class="w-10 h-10 rounded-full object-cover"
          />
          <div v-else class="w-10 h-10 rounded-full bg-gray-300"></div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="font-medium">@{{ c.peerUsername }}</span>
              <span v-if="c.peerDisplayName" class="text-xs text-gray-500">· {{ c.peerDisplayName }}</span>
            </div>

            <div class="text-xs text-gray-600 truncate max-w-[240px]">
              <span v-if="c.lastFileUrl">[فایل]</span>
              <span v-else>[پیام]</span>
              · {{ formatTime(c.lastSentAt) }}
            </div>
          </div>
        </div>

        <span
          v-if="c.unreadCount > 0"
          class="min-w-6 h-6 px-2 inline-flex items-center justify-center text-xs rounded-full bg-red-600 text-white"
        >
          {{ c.unreadCount }}
        </span>
      </li>
    </ul>

    <p v-if="!loading && items.length === 0" class="text-sm text-gray-500">گفتگویی وجود ندارد.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getConversations } from '../services/api'

const router = useRouter()
const loading = ref(false)
const items = ref<Array<{
  peerId: string
  peerUsername: string
  peerDisplayName?: string
  peerAvatarUrl?: string
  lastEncryptedContent?: string
  lastFileUrl?: string
  lastSentAt: string
  unreadCount: number
}>>([])

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

async function load() {
  loading.value = true
  try {
    items.value = await getConversations() // ← خروجی API دقیقا unreadCount دارد
  } finally {
    loading.value = false
  }
}

function openChat(c: { peerUsername: string }) {
  router.push(`/u/${c.peerUsername}`)
}

function onRefresh() { load() }

onMounted(() => {
  load()
  window.addEventListener('focus', onRefresh)
  window.addEventListener('refresh-conversations', onRefresh as EventListener)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', onRefresh)
  window.removeEventListener('refresh-conversations', onRefresh as EventListener)
})
</script>
