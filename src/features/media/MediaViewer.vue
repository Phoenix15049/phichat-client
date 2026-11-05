<template>
  <Teleport to="body">
    <Transition name="viewer" appear>
      <div
        v-if="current"
        ref="root"
        class="viewer"
        :class="[showChrome ? '' : 'cursor-none', floating ? 'viewer-floating' : '']"
        :inert="floating"
        dir="ltr"
        role="dialog"
        aria-modal="true"
        @pointermove="wake"
        @pointerdown="wake"
      >
        <!-- The picture's own colors, blurred, fill the room behind it -->
        <div class="absolute inset-0 overflow-hidden bg-[#0b1118]">
          <Transition name="ambient">
            <img v-if="current.kind === 'image'" :key="current.key" :src="current.src" alt="" class="ambient" />
          </Transition>
          <div class="absolute inset-0 bg-[#0b1118]/70"></div>
        </div>

        <!-- Top: who and when, then the tools -->
        <header class="top" :class="showChrome ? '' : 'chrome-hidden-top'">
          <button type="button" class="who" :title="$t('player.goToMessage')" @click="emit('goto', current)">
            <img v-if="current.senderAvatar" :src="current.senderAvatar" class="w-9 h-9 shrink-0 rounded-[35%] object-cover" alt="" />
            <span
              v-else
              class="w-9 h-9 shrink-0 rounded-[35%] grid place-items-center text-white text-xs font-semibold"
              :style="{ backgroundColor: colorFromString(current.senderName) }"
            >{{ initialsOf(current.senderName) }}</span>
            <span class="min-w-0 text-start leading-tight">
              <span class="block text-[13.5px] font-semibold text-white truncate"><bdi>{{ current.senderName }}</bdi></span>
              <span class="block text-[12px] text-white/60 truncate"><bdi>{{ current.date }}</bdi></span>
            </span>
          </button>

          <span v-if="shown.length > 1" class="hidden sm:block text-[13px] text-white/70 tabular-nums">{{ index + 1 }} / {{ shown.length }}</span>

          <div class="tools">
            <button v-if="current.kind === 'image'" type="button" class="tool" :title="$t('viewer.copy')" :aria-label="$t('viewer.copy')" @click="copyImage">
              <Copy class="w-[18px] h-[18px]" />
            </button>
            <button type="button" class="tool" :title="$t('chat.download')" :aria-label="$t('chat.download')" @click="emit('download', current)">
              <Download class="w-[18px] h-[18px]" />
            </button>
            <button type="button" class="tool" :title="$t('chat.forwardMenu')" :aria-label="$t('chat.forwardMenu')" @click="emit('forward', current)">
              <Forward class="w-[18px] h-[18px]" />
            </button>
            <button type="button" class="tool" :title="$t('player.goToMessage')" :aria-label="$t('player.goToMessage')" @click="emit('goto', current)">
              <MessageSquareText class="w-[18px] h-[18px]" />
            </button>
            <button type="button" class="tool hover:!text-danger" :title="$t('common.delete')" :aria-label="$t('common.delete')" @click="emit('delete', current)">
              <Trash2 class="w-[18px] h-[18px]" />
            </button>
            <span class="w-px h-5 bg-white/15 mx-0.5"></span>
            <button type="button" class="tool" :title="$t('common.close')" :aria-label="$t('common.close')" @click="emit('close')">
              <X class="w-5 h-5" />
            </button>
          </div>
        </header>

        <!-- The picture or video -->
        <div ref="stageBox" class="stage" :class="fullscreen ? 'stage-full' : ''">
          <ImageStage
            v-if="current.kind === 'image'"
            ref="imageStage"
            :item="current"
            @zoom="value => (zoom = value)"
            @previous="go(-1)"
            @next="go(1)"
            @close="emit('close')"
          />
          <VideoStage
            v-else
            ref="videoStage"
            :item="current"
            :chrome="showChrome"
            :fullscreen="fullscreen"
            @playing="value => (videoPlaying = value)"
            @pip="onPip"
            @close="emit('close')"
            @fullscreen="toggleFullscreen"
          />
        </div>

        <!-- Measured from the screen, not the stage: a caption or the zoom bar cannot move them -->
        <button v-if="shown.length > 1" type="button" class="nav left-3" :class="showChrome ? '' : 'opacity-0'" :aria-label="$t('player.previous')" @click="go(-1)">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <button v-if="shown.length > 1" type="button" class="nav right-3" :class="showChrome ? '' : 'opacity-0'" :aria-label="$t('player.next')" @click="go(1)">
          <ChevronRight class="w-6 h-6" />
        </button>

        <!-- Zoom and turn: below the picture, never over it -->
        <div v-if="current.kind === 'image'" class="relative z-10 shrink-0 flex justify-center pt-2">
          <div class="zoom-bar">
            <button type="button" class="tool" :disabled="zoom <= 1" :aria-label="$t('viewer.zoomOut')" :title="$t('viewer.zoomOut')" @click="imageStage?.zoomBy(1 / 1.5)">
              <Minus class="w-[18px] h-[18px]" />
            </button>
            <button type="button" class="w-12 text-[12.5px] text-white/85 tabular-nums hover:text-white" :title="$t('viewer.fit')" @click="imageStage?.reset()">{{ Math.round(zoom * 100) }}%</button>
            <button type="button" class="tool" :disabled="zoom >= 8" :aria-label="$t('viewer.zoomIn')" :title="$t('viewer.zoomIn')" @click="imageStage?.zoomBy(1.5)">
              <Plus class="w-[18px] h-[18px]" />
            </button>
            <span class="w-px h-5 bg-white/15 mx-0.5"></span>
            <button type="button" class="tool" :aria-label="$t('viewer.rotate')" :title="$t('viewer.rotate')" @click="imageStage?.rotate()">
              <RotateCcw class="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        <!-- Bottom: caption and the chat's other media -->
        <footer v-if="!fullscreen && (current.caption || shown.length > 1)" class="bottom" :class="showChrome ? '' : 'chrome-hidden-bottom'">
          <p v-if="current.caption" class="caption" dir="auto">{{ current.caption }}</p>

          <div v-if="shown.length > 1" ref="strip" class="strip">
            <button
              v-for="entry in stripItems"
              :key="entry.item.key"
              type="button"
              class="thumb"
              :class="entry.index === index ? 'thumb-on' : ''"
              :aria-label="`${entry.index + 1}`"
              :aria-current="entry.index === index"
              @click="index = entry.index"
            >
              <img v-if="entry.item.kind === 'image'" :src="entry.item.src" alt="" class="w-full h-full object-cover" draggable="false" />
              <template v-else>
                <video :src="`${entry.item.src}#t=0.1`" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
                <Play class="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" fill="currentColor" />
              </template>
            </button>
          </div>
        </footer>

        <Transition name="note">
          <div v-if="note" class="note">{{ note }}</div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ChevronLeft, ChevronRight, Copy, Download, Forward, MessageSquareText, Minus, Play, Plus, RotateCcw, Trash2, X
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { colorFromString, initialsOf } from '../../utils/avatar'
import ImageStage from './ImageStage.vue'
import VideoStage from './VideoStage.vue'
import type { MediaItem } from './types'

/** Thumbnails kept in the page on each side of the open item; a long chat can have hundreds. */
const STRIP_REACH = 25
const IDLE_MS = 2600

const props = defineProps<{
  items: MediaItem[]
  startKey: string
  /** Where the thumbnail was, so the picture can grow out of it. */
  origin?: DOMRect | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'floating', value: boolean): void
  (e: 'download' | 'forward' | 'goto' | 'delete' | 'shown', item: MediaItem): void
}>()

const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const stageBox = ref<HTMLElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const imageStage = ref<InstanceType<typeof ImageStage> | null>(null)
const videoStage = ref<InstanceType<typeof VideoStage> | null>(null)

/**
 * While a video floats in picture in picture the user is free to open another chat. The list is
 * kept as it was from then on, or the video would vanish with the chat it came from.
 */
const floating = ref(false)
const kept = ref<MediaItem[] | null>(null)
const shown = computed(() => kept.value ?? props.items)

const index = ref(Math.max(0, props.items.findIndex(item => item.key === props.startKey)))
const current = computed(() => shown.value[index.value] ?? null)
const zoom = ref(1)

const stripItems = computed(() => {
  const from = Math.max(0, index.value - STRIP_REACH)
  return shown.value.slice(from, index.value + STRIP_REACH + 1).map((item, i) => ({ item, index: from + i }))
})

function go(step: number) {
  const count = shown.value.length
  if (count > 1) index.value = (index.value + step + count) % count
}

/** The video went into (or came back from) its floating window: the chat is free meanwhile. */
function onPip(value: boolean) {
  floating.value = value
  if (value) {
    kept.value = [...shown.value]
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
  emit('floating', value)
}

// The list changes while open: older messages load, or the shown one gets deleted.
let shownKey = props.startKey
watch(() => props.items, items => {
  if (kept.value) return
  const found = items.findIndex(item => item.key === shownKey)
  if (found >= 0) index.value = found
  else if (!items.length) emit('close')
  else index.value = Math.min(index.value, items.length - 1)
})

watch(current, async item => {
  shownKey = item?.key ?? shownKey
  if (item) emit('shown', item)
  await nextTick()
  strip.value?.querySelector('.thumb-on')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}, { immediate: true })

// ---------- hiding the tools while a video plays ----------

const videoPlaying = ref(false)
const idle = ref(false)
let idleTimer: number | null = null

const showChrome = computed(() => !idle.value)

function wake() {
  idle.value = false
  if (idleTimer !== null) window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => { idle.value = videoPlaying.value }, IDLE_MS)
}

watch(videoPlaying, playing => {
  if (playing) wake()
  else idle.value = false
})

// ---------- full screen ----------

const fullscreen = ref(false)

function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement === root.value
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await root.value?.requestFullscreen()
  } catch {}
}

// ---------- copying ----------

const note = ref('')
let noteTimer: number | null = null

function showNote(text: string) {
  note.value = text
  if (noteTimer !== null) window.clearTimeout(noteTimer)
  noteTimer = window.setTimeout(() => { note.value = '' }, 1600)
}

/** The clipboard only takes PNG, so the picture is redrawn, turned the way it is shown. */
async function copyImage() {
  const item = current.value
  if (!item) return

  try {
    const bitmap = await createImageBitmap(await (await fetch(item.src)).blob())
    const turn = imageStage.value?.currentRotation() ?? 0
    const sideways = turn === 90 || turn === 270

    const canvas = document.createElement('canvas')
    canvas.width = sideways ? bitmap.height : bitmap.width
    canvas.height = sideways ? bitmap.width : bitmap.height

    const context = canvas.getContext('2d')!
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(turn * Math.PI / 180)
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('no image')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    showNote(t('viewer.copied'))
  } catch (error) {
    console.warn('copy image failed', error)
    showNote(t('viewer.copyFailed'))
  }
}

// ---------- keyboard ----------

function onKey(event: KeyboardEvent) {
  const item = current.value
  if (!item || floating.value || event.ctrlKey || event.metaKey || event.altKey) return

  const video = item.kind === 'video' ? videoStage.value : null
  const image = item.kind === 'image' ? imageStage.value : null
  const actions: Record<string, (() => void) | undefined> = {
    Escape: () => emit('close'),
    PageUp: () => go(-1),
    PageDown: () => go(1),
    ArrowLeft: () => (video ? video.seekBy(-5) : go(-1)),
    ArrowRight: () => (video ? video.seekBy(5) : go(1)),
    ' ': video ? () => void video.toggle() : undefined,
    k: video ? () => void video.toggle() : undefined,
    m: video ? () => video.toggleMute() : undefined,
    f: video ? () => void toggleFullscreen() : undefined,
    '+': image ? () => image.zoomBy(1.5) : undefined,
    '=': image ? () => image.zoomBy(1.5) : undefined,
    '-': image ? () => image.zoomBy(1 / 1.5) : undefined,
    '0': image ? () => image.reset() : undefined,
    r: image ? () => image.rotate() : undefined
  }

  const action = actions[event.key]
  if (!action) return

  event.preventDefault()
  event.stopPropagation()
  wake()
  action()
}

// ---------- opening ----------

/** The picture grows out of its place in the chat. */
async function growFromOrigin() {
  const from = props.origin
  const media = stageBox.value?.querySelector<HTMLElement>('img, video')
  if (!from || !media || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // The size is known once the first frame or the picture has loaded.
  await new Promise<void>(resolve => {
    const ready = media instanceof HTMLImageElement ? media.complete : (media as HTMLVideoElement).readyState >= 1
    if (ready) return resolve()
    media.addEventListener(media instanceof HTMLImageElement ? 'load' : 'loadedmetadata', () => resolve(), { once: true })
    window.setTimeout(resolve, 160)
  })

  // The fitted size is applied on the next render.
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)

  const to = media.getBoundingClientRect()
  if (!to.width || !to.height) return

  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const scale = Math.min(from.width / to.width, from.height / to.height)

  media.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.6 }, { transform: 'none', opacity: 1 }],
    { duration: 300, easing: 'cubic-bezier(.2, .9, .25, 1)' }
  )
}

onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  void nextTick(growFromOrigin)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (idleTimer !== null) window.clearTimeout(idleTimer)
  if (noteTimer !== null) window.clearTimeout(noteTimer)
  if (document.fullscreenElement === root.value) void document.exitFullscreen().catch(() => {})
})
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.viewer {
  @apply fixed inset-0 z-[1000] flex flex-col text-white select-none;
}
/* Out of the way while the video plays in its floating window, but still alive: it owns the video. */
.viewer-floating {
  opacity: 0;
  pointer-events: none;
}
.ambient {
  @apply absolute inset-0 w-full h-full object-cover opacity-60;
  filter: blur(70px) saturate(160%);
  transform: scale(1.25);
}
.ambient-enter-from, .ambient-leave-to { opacity: 0; }
.ambient-enter-active, .ambient-leave-active { transition: opacity .45s ease; }

.top {
  @apply relative z-10 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 pt-3 pb-2 transition duration-200;
}
.chrome-hidden-top { @apply opacity-0 -translate-y-2 pointer-events-none; }
.chrome-hidden-bottom { @apply opacity-0 translate-y-2 pointer-events-none; }

.who {
  @apply flex items-center gap-2.5 min-w-0 max-w-[45%] rounded-2xl p-1.5 pe-3 bg-white/[.07] ring-1 ring-white/10 backdrop-blur-xl hover:bg-white/[.12] transition;
}
.tools {
  @apply flex items-center gap-0.5 rounded-2xl p-1 bg-white/[.07] ring-1 ring-white/10 backdrop-blur-xl;
}
.tool {
  @apply inline-grid place-items-center w-9 h-9 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition active:scale-90 disabled:opacity-35 disabled:pointer-events-none;
}

.stage {
  @apply relative flex-1 min-h-0 mx-2 sm:mx-16;
}
.stage-full {
  @apply mx-0;
}
.zoom-bar {
  @apply flex items-center gap-0.5 rounded-2xl p-1 bg-white/[.07] ring-1 ring-white/10 backdrop-blur-xl;
}
.nav {
  @apply absolute z-20 top-1/2 -translate-y-1/2 hidden sm:grid place-items-center w-11 h-11 rounded-[35%] bg-white/[.08] ring-1 ring-white/10 text-white/85 hover:bg-accent hover:text-white hover:ring-accent backdrop-blur-xl transition;
}

.bottom {
  @apply relative z-10 shrink-0 flex flex-col items-center gap-2 px-3 pt-2 pb-3 transition duration-200;
}
.caption {
  @apply max-w-2xl max-h-[16vh] overflow-y-auto text-center text-[14px] leading-6 text-white/90 whitespace-pre-wrap break-words select-text;
}
.strip {
  @apply flex items-center gap-1.5 max-w-full overflow-x-auto py-1 px-1;
  scrollbar-width: none;
}
.strip::-webkit-scrollbar { display: none; }
.thumb {
  @apply relative w-12 h-12 shrink-0 overflow-hidden rounded-[30%] opacity-55 hover:opacity-90 transition duration-150;
}
.thumb-on {
  @apply opacity-100 scale-110;
  box-shadow: 0 0 0 2px var(--color-accent);
}

.note {
  @apply absolute bottom-24 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-black/70 px-3 py-1.5 text-[13px] backdrop-blur;
}
.note-enter-from, .note-leave-to { opacity: 0; transform: translate(-50%, 6px); }
.note-enter-active, .note-leave-active { transition: opacity .14s ease, transform .14s ease; }

.viewer-enter-from, .viewer-leave-to { opacity: 0; }
.viewer-enter-active { transition: opacity .2s ease; }
.viewer-leave-active { transition: opacity .15s ease; }
</style>
