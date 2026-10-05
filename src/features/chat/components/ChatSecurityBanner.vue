<template>
  <div
    v-if="props.keyChanged"
    class="flex items-start gap-2 px-4 py-2 text-[13px] bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/25"
    role="status"
  >
    <ShieldAlert class="w-4 h-4 mt-0.5 shrink-0" />
    <div class="flex-1 min-w-0">
      {{ $t('e2ee.keyChangedBanner', { name: isolate(props.peerName) }) }}
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button type="button" class="underline hover:no-underline" @click="emit('view-code')">
        {{ $t('e2ee.viewCode') }}
      </button>
      <button type="button" class="rounded-full px-2 py-0.5 bg-amber-200/70 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30" @click="emit('acknowledge')">
        {{ $t('e2ee.acknowledge') }}
      </button>
    </div>
  </div>

  <div
    v-else-if="props.missingKey"
    class="flex items-start gap-2 px-4 py-2 text-[13px] bg-surface-2 text-muted border-b border-line"
    role="status"
  >
    <Lock class="w-4 h-4 mt-0.5 shrink-0" />
    <div class="flex-1 min-w-0">
      {{ $t('e2ee.peerNoKeyBanner', { name: isolate(props.peerName) }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Lock, ShieldAlert } from 'lucide-vue-next'
import { isolate } from '../../../utils/username'

const props = defineProps<{
  peerName: string
  keyChanged: boolean
  missingKey: boolean
}>()

const emit = defineEmits<{
  (e: 'view-code'): void
  (e: 'acknowledge'): void
}>()
</script>
