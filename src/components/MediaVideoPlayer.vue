<script setup lang="ts">
const props = defineProps<{ src: string, caption?: string }>()
const emit  = defineEmits<{ (e:'close'): void }>()
</script>

<template>
  <div class="fixed inset-0 z-[1000] bg-black/90 backdrop-blur flex flex-col" @click.self="emit('close')">
    <div class="flex items-center justify-between p-3 text-white/90">
      <div class="truncate max-w-[70%]">{{ caption }}</div>
      <button class="px-3 py-1 rounded bg-white/10 hover:bg-white/20" @click="emit('close')">بستن</button>
    </div>
    <div class="flex-1 grid place-items-center">
      <video :src="src" controls playsinline class="max-h-full max-w-full rounded-lg bg-black"></video>
    </div>
  </div>
</template>
