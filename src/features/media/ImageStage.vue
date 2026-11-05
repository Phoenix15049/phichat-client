<template>
  <div
    ref="stage"
    class="absolute inset-0 overflow-hidden select-none touch-none"
    :class="scale > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="onDoubleClick"
  >
    <img
      ref="image"
      :key="item.key"
      :src="item.src"
      :alt="item.name"
      draggable="false"
      class="absolute max-w-none will-change-transform rounded-[4px]"
      :class="smooth ? 'transition-transform duration-200 ease-out' : ''"
      :style="[centeredStyle(fitted), { transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})` }]"
      @load="onLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { MediaItem } from './types'
import { centeredStyle, useFitSize, type PixelSize } from './useFitSize'

const MIN_SCALE = 1
const MAX_SCALE = 8
const DOUBLE_CLICK_SCALE = 2.5
/** Movement below this is a click, not a drag. */
const CLICK_SLOP = 6
const SWIPE_DISTANCE = 70
/** A small picture grows to be seen, but not until it is a blur. */
const MAX_UPSCALE = 2.5

const props = defineProps<{ item: MediaItem }>()
const emit = defineEmits<{
  (e: 'zoom', value: number): void
  (e: 'previous' | 'next' | 'close'): void
}>()

const stage = ref<HTMLElement | null>(null)
const image = ref<HTMLImageElement | null>(null)

const scale = ref(1)
const x = ref(0)
const y = ref(0)
const rotation = ref(0)
const smooth = ref(false)
const dragging = ref(false)

const natural = ref<PixelSize | null>(null)
const sideways = computed(() => Math.abs(rotation.value % 180) === 90)
const fitted = useFitSize(stage, natural, { maxUpscale: MAX_UPSCALE, sideways })

function onLoad(event: Event) {
  const { naturalWidth: width, naturalHeight: height } = event.target as HTMLImageElement
  natural.value = { width, height }
}

// The window or the turn changed the fit, so the limits of panning moved too.
watch(fitted, () => void nextTick(clampPan))

let smoothTimer: number | null = null

/** Button and double-click changes glide; wheel and fingers follow directly. */
function glide() {
  smooth.value = true
  if (smoothTimer !== null) window.clearTimeout(smoothTimer)
  smoothTimer = window.setTimeout(() => { smooth.value = false }, 220)
}

/** Keeps the picture covering the stage: it can only move as far as it is larger than the stage. */
function clampPan() {
  const box = stage.value
  const picture = image.value
  if (!box || !picture) return

  const width = (sideways.value ? picture.offsetHeight : picture.offsetWidth) * scale.value
  const height = (sideways.value ? picture.offsetWidth : picture.offsetHeight) * scale.value
  const limitX = Math.max(0, (width - box.clientWidth) / 2)
  const limitY = Math.max(0, (height - box.clientHeight) / 2)

  x.value = Math.min(limitX, Math.max(-limitX, x.value))
  y.value = Math.min(limitY, Math.max(-limitY, y.value))
}

/** Zooms keeping the point under `clientX/Y` where it is. */
function zoomTo(next: number, clientX?: number, clientY?: number) {
  const box = stage.value?.getBoundingClientRect()
  const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
  if (!box) return

  const px = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2)
  const py = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2)
  const ratio = target / scale.value

  x.value = px - (px - x.value) * ratio
  y.value = py - (py - y.value) * ratio
  scale.value = target
  clampPan()
  emit('zoom', target)
}

function onWheel(event: WheelEvent) {
  zoomTo(scale.value * Math.exp(-event.deltaY * 0.0016), event.clientX, event.clientY)
}

function onDoubleClick(event: MouseEvent) {
  glide()
  if (scale.value > 1) reset()
  else zoomTo(DOUBLE_CLICK_SCALE, event.clientX, event.clientY)
}

// ---------- pointers: drag, pinch, swipe ----------

const pointers = new Map<number, { x: number; y: number }>()
let start = { x: 0, y: 0, panX: 0, panY: 0 }
let pinch: { distance: number; scale: number } | null = null
let moved = false
/** What the press started on; once the pointer is captured, later events all report the stage. */
let pressedOn: EventTarget | null = null

function distance() {
  const [a, b] = [...pointers.values()]
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  pressedOn = event.target
  stage.value?.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size === 2) {
    pinch = { distance: distance(), scale: scale.value }
  } else {
    start = { x: event.clientX, y: event.clientY, panX: x.value, panY: y.value }
    moved = false
    dragging.value = true
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    zoomTo(pinch.scale * distance() / pinch.distance, (a.x + b.x) / 2, (a.y + b.y) / 2)
    moved = true
    return
  }

  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (Math.hypot(dx, dy) > CLICK_SLOP) moved = true

  if (scale.value > 1) {
    x.value = start.panX + dx
    y.value = start.panY + dy
    clampPan()
  }
}

function onPointerUp(event: PointerEvent) {
  if (!pointers.delete(event.pointerId)) return
  dragging.value = false

  if (pointers.size > 0 || pinch) {
    if (pointers.size === 0) pinch = null
    return
  }

  const dx = event.clientX - start.x
  const dy = event.clientY - start.y

  if (!moved) {
    // A click beside the picture closes; on the picture it does nothing.
    if (pressedOn === stage.value) emit('close')
  } else if (scale.value === 1 && event.pointerType !== 'mouse') {
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) emit(dx > 0 ? 'previous' : 'next')
    else if (dy > SWIPE_DISTANCE * 1.5) emit('close')
  }
}

// ---------- tools ----------

function reset() {
  glide()
  scale.value = 1
  x.value = 0
  y.value = 0
  emit('zoom', 1)
}

function zoomBy(factor: number) {
  glide()
  zoomTo(scale.value * factor)
}

function rotate() {
  glide()
  rotation.value -= 90
  x.value = 0
  y.value = 0
  clampPan()
}

/** The picture as the user turned it, for copying. */
function currentRotation() {
  return ((rotation.value % 360) + 360) % 360
}

watch(() => props.item.key, () => {
  natural.value = null
  smooth.value = false
  scale.value = 1
  x.value = 0
  y.value = 0
  rotation.value = 0
  emit('zoom', 1)
})

defineExpose({ zoomBy, reset, rotate, currentRotation })
</script>
