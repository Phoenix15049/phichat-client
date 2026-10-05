<template>
  <div v-if="props.open" class="fixed inset-0 z-50 bg-overlay" @click.self="emit('close')">
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl ring-1 ring-line p-5 w-[360px] max-w-[calc(100vw-32px)]">
      <div class="text-lg font-semibold text-ink mb-2">{{ $t('chat.deleteTitle') }}</div>
      <p class="text-sm text-ink mb-3">{{ $t('chat.deleteConfirm', { count: props.count }, props.count) }}</p>

      <label class="flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          class="accent-[var(--color-danger)]"
          :checked="props.forAll"
          :disabled="!props.canAll"
          @change="onScopeChange"
        />
        <span :class="props.canAll ? '' : 'text-muted'">{{ $t('chat.deleteForEveryone') }}</span>
      </label>

      <div class="flex items-center justify-end gap-2">
        <button class="btn-ghost px-4 py-2" @click="emit('close')">{{ $t('common.cancel') }}</button>
        <button class="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-danger text-white font-medium hover:brightness-110 transition" @click="emit('confirm')">{{ $t('common.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  count: number
  canAll: boolean
  forAll: boolean
}>()

const emit = defineEmits<{
  (event: 'update:forAll', value: boolean): void
  (event: 'close' | 'confirm'): void
}>()

function onScopeChange(event: Event) {
  emit('update:forAll', (event.target as HTMLInputElement).checked)
}
</script>