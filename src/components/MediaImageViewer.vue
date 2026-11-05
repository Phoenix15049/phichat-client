<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  src: string
  caption?: string
  /** The album being viewed: arrows and the keyboard move through it. */
  gallery?: Array<{ src: string; caption?: string }>
  startIndex?: number
}>()
const emit  = defineEmits<{ (e:'close'): void }>()

const index = ref(props.startIndex ?? 0)
const count = computed(() => props.gallery?.length ?? 1)
const current = computed(() => props.gallery?.[index.value] ?? { src: props.src, caption: props.caption })

function go(step: number) {
  if (count.value < 2) return
  index.value = (index.value + step + count.value) % count.value
  scale.value = 1
  ox.value = 0
  oy.value = 0
}
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

function onKey(e: KeyboardEvent){
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 z-[1000] bg-black/90 backdrop-blur flex flex-col" @click.self="emit('close')">
    <div class="flex items-center justify-between p-3 text-white/90">
      <div class="truncate max-w-[70%]">
        <span v-if="count > 1" class="me-2 tabular-nums text-white/60" dir="ltr">{{ index + 1 }} / {{ count }}</span>{{ current.caption }}
      </div>
      <button class="px-3 py-1 rounded bg-white/10 hover:bg-white/20" @click="emit('close')">{{ $t('common.close') }}</button>
    </div>
    <div class="relative flex-1 grid place-items-center overflow-hidden select-none"
         @wheel.passive="onWheel"
         @mousedown="onMouseDown" @mousemove="onMouseMove"
         @mouseup="onMouseUp" @mouseleave="onMouseUp">
      <img :src="current.src" class="max-h-full max-w-full will-change-transform"
           :style="{ transform:`translate(${ox}px,${oy}px) scale(${scale})` }"/>
      <template v-if="count > 1">
        <button class="nav left-3" :aria-label="$t('player.previous')" @mousedown.stop @click.stop="go(-1)"><ChevronLeft class="w-6 h-6" /></button>
        <button class="nav right-3" :aria-label="$t('player.next')" @mousedown.stop @click.stop="go(1)"><ChevronRight class="w-6 h-6" /></button>
      </template>
    </div>
  </div>
</template>

<style scoped>
@reference "../assets/tailwind.css";

.nav {
  @apply absolute top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur transition;
}
</style>
