<template>
  <section class="space-y-3">
    <div class="flex items-center gap-2 text-ink font-medium">
      <Ban class="w-4 h-4 text-danger" />
      <span>{{ $t('settings.blockedUsers') }}</span>
    </div>
    <p class="text-sm text-muted">{{ $t('settings.blockedUsersHint') }}</p>

    <div v-if="!blocks.loaded" class="flex justify-center py-3 text-muted"><Loader2 class="w-5 h-5 animate-spin" /></div>

    <p v-else-if="!blocks.list.length" class="text-sm text-muted py-2">{{ $t('settings.noBlockedUsers') }}</p>

    <ul v-else class="divide-y divide-line">
      <li v-for="user in blocks.list" :key="user.userId" class="flex items-center gap-3 py-2">
        <div
          class="w-10 h-10 rounded-full overflow-hidden grid place-items-center shrink-0"
          :style="!user.avatarUrl ? { backgroundColor: colorFromString(user.displayName || user.username) } : {}"
        >
          <img v-if="user.avatarUrl" :src="user.avatarUrl" class="w-full h-full object-cover" alt="" />
          <span v-else class="text-white text-sm font-semibold">{{ initialsOf(user.displayName || user.username) }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-ink truncate"><bdi>{{ user.displayName || '@' + user.username }}</bdi></div>
          <div class="text-xs text-muted truncate" dir="ltr">@{{ user.username }}</div>
        </div>
        <button type="button" class="btn-outline text-sm px-3 py-1.5" :disabled="busy === user.userId" @click="unblock(user.userId)">
          {{ $t('profile.unblock') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Ban, Loader2 } from 'lucide-vue-next'
import { useBlocksStore } from '../../stores/blocks'
import { colorFromString, initialsOf } from '../../utils/avatar'

const blocks = useBlocksStore()
const busy = ref<string | null>(null)

onMounted(() => { void blocks.load() })

async function unblock(userId: string) {
  busy.value = userId
  try {
    await blocks.unblock(userId)
  } finally {
    busy.value = null
  }
}
</script>
