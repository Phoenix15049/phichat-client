<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="w-full flex items-center justify-between gap-4 text-start py-1"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="min-w-0">
      <span class="block text-sm text-ink">{{ label }}</span>
      <span v-if="description" class="block text-xs text-muted mt-0.5">{{ description }}</span>
    </span>
    <span class="switch shrink-0" :class="modelValue ? 'switch-on' : ''"><span class="switch-knob"></span></span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; description?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.switch {
  @apply relative w-10 h-6 rounded-full bg-line transition-colors;
}
.switch-on {
  @apply bg-accent;
}
.switch-knob {
  @apply absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform;
}
.switch-on .switch-knob {
  transform: translateX(16px);
}
:global([dir="rtl"] .switch-on .switch-knob) {
  transform: translateX(-16px);
}
</style>
