<template>
  <div class="shrink-0 bg-surface border-b border-line px-2 sm:px-3 py-2 flex items-center gap-2">
    <div class="relative flex-1 min-w-0">
      <Search class="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted pointer-events-none" />
      <input
        ref="input"
        :value="query"
        type="search"
        class="w-full h-9 rounded-full bg-surface-2 ps-9 pe-3 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 ring-accent/50"
        :placeholder="$t('chat.searchInChat')"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('go', $event.shiftKey ? -1 : 1)"
        @keydown.esc.prevent="emit('close')"
      />
    </div>

    <span v-if="query.trim()" class="shrink-0 text-xs text-muted tabular-nums">
      {{ total ? $t('chat.searchPosition', { current: index + 1, total }) : $t('chat.noSearchResults') }}
    </span>

    <button
      v-if="hasMore"
      type="button"
      class="shrink-0 text-xs font-medium text-accent hover:underline disabled:opacity-60 inline-flex items-center gap-1"
      :disabled="loadingOlder"
      @click="emit('search-older')"
    >
      <Loader2 v-if="loadingOlder" class="w-3.5 h-3.5 animate-spin" />
      {{ $t('chat.searchOlder') }}
    </button>

    <button type="button" class="icon-btn w-8 h-8" :disabled="!total" :aria-label="$t('chat.olderResult')" @click="emit('go', 1)">
      <ChevronUp class="w-4 h-4" />
    </button>
    <button type="button" class="icon-btn w-8 h-8" :disabled="!total" :aria-label="$t('chat.newerResult')" @click="emit('go', -1)">
      <ChevronDown class="w-4 h-4" />
    </button>
    <button type="button" class="icon-btn w-8 h-8" :aria-label="$t('common.close')" @click="emit('close')">
      <X class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-vue-next'

defineProps<{
  query: string
  index: number
  total: number
  hasMore: boolean
  loadingOlder: boolean
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'go', step: 1 | -1): void
  (e: 'search-older'): void
  (e: 'close'): void
}>()

const input = ref<HTMLInputElement | null>(null)
onMounted(() => input.value?.focus())
</script>
