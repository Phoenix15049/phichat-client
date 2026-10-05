<template>
  <aside
    class="flex flex-col bg-surface border-line"
    :class="props.isNarrow ? 'w-full' : 'w-80 lg:w-[380px] border-e'"
  >
    <div class="h-14 shrink-0 px-2 flex items-center gap-1">
      <button type="button" class="icon-btn shrink-0" :aria-label="$t('menu.open')" @click="emit('open-menu')">
        <Menu class="w-5 h-5" />
      </button>

      <div class="relative flex-1">
        <Search class="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted pointer-events-none" />
        <input
          v-model="query"
          type="search"
          class="w-full h-10 rounded-full bg-surface-2 ps-9 pe-3 text-sm text-ink placeholder:text-muted outline-none ring-accent/50 focus:ring-2 transition"
          :placeholder="$t('chat.searchChats')"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <button
        v-for="conversation in filtered"
        :key="conversation.peerId"
        v-ripple
        type="button"
        class="relative overflow-hidden w-full px-2.5 py-2 rounded-xl flex gap-3 items-center text-start transition-colors"
        :class="props.selectedUserId === conversation.peerId ? 'bg-accent-soft' : 'hover:bg-surface-2'"
        @click.stop="emit('select', conversation)"
      >
        <div class="relative shrink-0">
          <div
            class="w-12 h-12 rounded-full overflow-hidden grid place-items-center"
            :style="!props.avatarById[conversation.peerId] ? { backgroundColor: colorFromString(nameOf(conversation)) } : {}"
          >
            <img
              v-if="props.avatarById[conversation.peerId]"
              :src="props.avatarById[conversation.peerId] || ''"
              class="w-full h-full object-cover"
              alt=""
            />
            <span v-else class="text-white font-semibold">{{ initialsOf(nameOf(conversation)) }}</span>
          </div>
          <span
            v-if="props.onlineIds.has(conversation.peerId)"
            class="absolute bottom-0.5 end-0.5 w-3 h-3 rounded-full bg-accent ring-2 ring-surface"
          ></span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <div class="flex-1 min-w-0 font-semibold text-[15px] text-ink truncate">
              <bdi>{{ nameOf(conversation) }}</bdi>
            </div>
            <div class="shrink-0 text-[12px]" :class="conversation.unreadCount > 0 ? 'text-accent' : 'text-muted'">
              {{ formatListTime(conversation.lastSentAt || null) }}
            </div>
          </div>

          <div class="mt-0.5 flex items-center gap-2">
            <div class="flex-1 min-w-0 text-[13.5px] text-muted truncate">
              <span v-if="conversation.lastFileUrl && !conversation.lastPreview" class="inline-flex items-center gap-1">
                <Paperclip class="w-3.5 h-3.5 shrink-0" />
                <span>{{ $t('common.media') }}</span>
              </span>
              <bdi v-else>{{ conversation.lastPreview || '' }}</bdi>
            </div>
            <span
              v-if="conversation.unreadCount > 0"
              class="shrink-0 inline-flex items-center justify-center rounded-full bg-accent text-white text-[12px] font-semibold min-w-[22px] h-[22px] px-1.5"
            >
              {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
            </span>
          </div>
        </div>
      </button>

      <div v-if="!filtered.length" class="h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-muted">
        <MessagesSquare class="w-10 h-10 opacity-60" />
        <div class="text-sm">{{ query ? $t('chat.noSearchResults') : $t('chat.noChats') }}</div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { colorFromString, initialsOf } from '../../../utils/avatar'
import { Menu, MessagesSquare, Paperclip, Search } from 'lucide-vue-next'
import { formatListTime } from '../../../utils/time'
import type { UiConversation } from '../../../types/chat'

const props = defineProps<{
  conversations: UiConversation[]
  selectedUserId: string | null
  isNarrow: boolean
  onlineIds: Set<string>
  avatarById: Record<string, string | null>
  displayById: Record<string, string | null>
}>()

const emit = defineEmits<{
  (event: 'select', conversation: UiConversation): void
  (event: 'open-menu'): void
}>()

const query = ref('')

function nameOf(conversation: UiConversation) {
  return props.displayById[conversation.peerId] || conversation.displayName || '@' + conversation.username
}

/** Filters by name or username (the previews are decrypted locally, so they are searchable too). */
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.conversations
  return props.conversations.filter(c =>
    nameOf(c).toLowerCase().includes(q) ||
    c.username.toLowerCase().includes(q) ||
    (c.lastPreview || '').toLowerCase().includes(q)
  )
})
</script>
