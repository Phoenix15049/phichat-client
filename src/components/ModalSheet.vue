<template>
  <div v-if="open" class="fixed inset-0 z-[60]">
    <div class="absolute inset-0 bg-black/30" @click="$emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                bg-white rounded-2xl shadow-xl w-[520px] max-w-[95vw] max-h-[90vh] overflow-auto">
      <slot/>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>()
defineEmits<{ (e:'close'):void }>()
</script>
