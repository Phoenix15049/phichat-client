<template>
  <div class="shrink-0 bg-surface border-b border-line px-2 sm:px-3 py-1.5 flex items-center gap-2">
    <!-- One segment per pin; the highlighted one is shown -->
    <div v-if="count > 1" class="flex flex-col gap-0.5 self-stretch py-0.5">
      <span
        v-for="i in Math.min(count, 4)"
        :key="i"
        class="w-[3px] flex-1 rounded-full"
        :class="i - 1 === index % 4 ? 'bg-accent' : 'bg-accent/30'"
      ></span>
    </div>
    <span v-else class="w-[3px] self-stretch rounded-full bg-accent"></span>

    <button type="button" class="flex-1 min-w-0 text-start py-0.5" @click="emit('open')">
      <div class="text-[13px] font-semibold text-accent">
        {{ count > 1 ? $t('chat.pinnedNumbered', { n: index + 1 }) : $t('chat.pinnedMessage') }}
      </div>
      <div class="text-[13px] text-ink truncate"><bdi>{{ text }}</bdi></div>
    </button>

    <button type="button" class="icon-btn w-8 h-8" :title="$t('chat.unpin')" :aria-label="$t('chat.unpin')" @click="emit('unpin')">
      <PinOff class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { PinOff } from 'lucide-vue-next'

defineProps<{ text: string; index: number; count: number }>()
const emit = defineEmits<{ (e: 'open'): void; (e: 'unpin'): void }>()
</script>
