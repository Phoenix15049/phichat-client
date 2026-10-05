<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="open" class="fixed inset-0 z-[95]" role="alertdialog" aria-modal="true">
        <div class="absolute inset-0 bg-overlay" @click="emit('cancel')"></div>
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[92vw] rounded-2xl bg-surface shadow-2xl ring-1 ring-line p-5">
          <div class="text-lg font-semibold text-ink mb-2">{{ title }}</div>
          <p class="text-sm text-muted leading-6 mb-5">{{ message }}</p>
          <div class="flex items-center justify-end gap-2">
            <button type="button" class="btn-ghost px-4 py-2" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              :class="danger ? 'bg-danger' : 'bg-accent'"
              :disabled="busy"
              @click="emit('confirm')"
            >{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean }>()
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>

<style scoped>
.confirm-enter-from, .confirm-leave-to { opacity: 0; }
.confirm-enter-active, .confirm-leave-active { transition: opacity .14s ease; }
</style>
