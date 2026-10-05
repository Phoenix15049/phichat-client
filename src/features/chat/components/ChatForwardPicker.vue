<template>
  <div v-if="props.open" class="fixed inset-0 z-40 bg-overlay" @click.self="emit('close')">
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl ring-1 ring-line p-3 w-[340px] max-w-[calc(100vw-32px)]">
      <div class="text-lg font-semibold text-ink px-2 mb-2">
        {{ props.mode === 'multi' ? $t('chat.forwardManyTo', { count: props.count }) : $t('chat.forwardTo') }}
      </div>

      <div class="max-h-64 overflow-y-auto">
        <button
          v-for="conversation in props.conversations"
          :key="conversation.peerId"
          class="w-full text-start px-3 py-2.5 rounded-xl text-ink hover:bg-surface-2"
          @click="emit('select',conversation.peerId)"
        >
          <bdi>{{ conversation.displayName || `@${conversation.username}` }}</bdi>
        </button>
      </div>

      <div class="mt-2 text-start">
        <button class="text-xs text-muted hover:text-ink" @click="emit('close')">{{ $t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UiConversation } from '../../../types/chat'

const props = defineProps<{
  open: boolean
  mode: 'single' | 'multi'
  count: number
  conversations: UiConversation[]
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select', peerId: string): void
}>()
</script>