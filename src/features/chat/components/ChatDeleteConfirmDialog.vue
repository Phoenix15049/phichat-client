<template>
  <div v-if="props.open" class="fixed inset-0 z-50 bg-black/30" @click.self="emit('close')">
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow p-4 w-[360px]">
      <div class="font-medium mb-2">Delete messages</div>
      <p class="text-sm text-gray-700 mb-3">Delete {{ props.count }} message(s)?</p>

      <label class="flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          class="accent-red-600"
          :checked="props.forAll"
          :disabled="!props.canAll"
          @change="onScopeChange"
        />
        <span :class="props.canAll ? '' : 'text-gray-400'">Delete for everyone</span>
      </label>

      <div class="flex items-center justify-end gap-2">
        <button class="px-3 py-1.5 rounded border" @click="emit('close')">Cancel</button>
        <button class="px-3 py-1.5 rounded bg-red-600 text-white" @click="emit('confirm')">Delete</button>
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