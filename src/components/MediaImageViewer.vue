<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ src: string, caption?: string }>()
const emit  = defineEmits<{ (e:'close'): void }>()
const scale = ref(1)
const ox = ref(0); const oy = ref(0)
let dragging = false, sx = 0, sy = 0

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = -e.deltaY / 500
  const next = Math.min(5, Math.max(0.3, scale.value + delta))
  scale.value = next
}
function onMouseDown(e: MouseEvent) { dragging = true; sx = e.clientX - ox.value; sy = e.clientY - oy.value }
function onMouseMove(e: MouseEvent) { if (!dragging) return; ox.value = e.clientX - sx; oy.value = e.clientY - sy }
function onMouseUp() { dragging = false }

function onKey(e: KeyboardEvent){ if (e.key === 'Escape') emit('close') }

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 z-[1000] bg-black/90 backdrop-blur flex flex-col" @click.self="emit('close')">
    <div class="flex items-center justify-between p-3 text-white/90">
      <div class="truncate max-w-[70%]">{{ caption }}</div>
      <button class="px-3 py-1 rounded bg-white/10 hover:bg-white/20" @click="emit('close')">بستن</button>
    </div>
    <div class="flex-1 grid place-items-center overflow-hidden select-none"
         @wheel.passive="onWheel"
         @mousedown="onMouseDown" @mousemove="onMouseMove"
         @mouseup="onMouseUp" @mouseleave="onMouseUp">
      <img :src="src" class="max-h-full max-w-full will-change-transform"
           :style="{ transform:`translate(${ox}px,${oy}px) scale(${scale})` }"/>
    </div>
  </div>
</template>
