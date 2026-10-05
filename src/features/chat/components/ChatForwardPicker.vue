<template>
  <div v-if="props.open" class="fixed inset-0 z-40 bg-black/20" @click.self="emit('close')">
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow p-3 w-[320px]">
      <div class="font-medium mb-2">
        {{ props.mode === 'multi' ? $t('chat.forwardManyTo', { count: props.count }) : $t('chat.forwardTo') }}
      </div>

      <div class="max-h-64 overflow-y-auto">
        <button
          v-for="conversation in props.conversations"
          :key="conversation.peerId"
          class="w-full text-start px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
          @click="emit('select',conversation.peerId)"
        >
          <bdi>{{ conversation.displayName || `@${conversation.username}` }}</bdi>
        </button>
      </div>

      <div class="mt-2 text-start">
        <button class="text-xs text-gray-500 hover:text-gray-700" @click="emit('close')">{{ $t('common.close') }}</button>
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