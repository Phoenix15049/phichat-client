<template>
  <div ref="box" class="absolute inset-0 overflow-hidden" @click.self="emit('close')">
    <video
      ref="video"
      :src="item.src"
      playsinline
      class="absolute max-w-none rounded-[4px] outline-none"
      :style="centeredStyle(fitted)"
      :loop="loop"
      @click="toggle"
      @dblclick="emit('fullscreen')"
      @timeupdate="time = video?.currentTime ?? 0"
      @loadedmetadata="onMetadata"
      @durationchange="onDuration"
      @progress="onProgress"
      @enterpictureinpicture="emit('pip', true)"
      @leavepictureinpicture="onLeavePip"
      @play="setPlaying(true)"
      @pause="onPause"
      @ended="setPlaying(false)"
      @waiting="waiting = true"
      @playing="waiting = false"
      @canplay="waiting = false"
    ></video>

    <!-- State in the middle of the picture -->
    <Transition name="pop">
      <button v-if="!playing && !waiting" type="button" class="big-play" :aria-label="$t('chat.play')" @click="toggle">
        <Play class="w-8 h-8 translate-x-0.5" fill="currentColor" />
      </button>
    </Transition>
    <Loader2 v-if="waiting" class="absolute top-1/2 left-1/2 -mt-5 -ml-5 w-10 h-10 text-white/80 animate-spin pointer-events-none" />

    <!-- Controls -->
    <div class="bar" :class="chrome ? '' : 'bar-hidden'" @click.stop>
      <div
        ref="track"
        class="seek"
        role="slider"
        tabindex="0"
        :aria-label="$t('player.position')"
        aria-valuemin="0"
        :aria-valuemax="Math.round(duration)"
        :aria-valuenow="Math.round(time)"
        @pointerdown="startSeek"
        @pointermove="onHover"
        @pointerleave="hover = null"
      >
        <span class="seek-line"></span>
        <span class="seek-line bg-white/30" :style="{ width: `${buffered * 100}%` }"></span>
        <span class="seek-line bg-accent" :style="{ width: `${progress * 100}%` }"></span>
        <span class="seek-knob" :style="{ left: `${progress * 100}%` }"></span>
        <span v-if="hover" class="seek-tip" :style="{ left: `${hover.ratio * 100}%` }">{{ formatClock(hover.ratio * duration) }}</span>
      </div>

      <div class="flex items-center gap-0.5">
        <button type="button" class="ctl" :aria-label="playing ? $t('chat.pause') : $t('chat.play')" @click="toggle">
          <Pause v-if="playing" class="w-[18px] h-[18px]" fill="currentColor" />
          <Play v-else class="w-[18px] h-[18px]" fill="currentColor" />
        </button>

        <span class="px-1.5 text-[12.5px] text-white/85 tabular-nums whitespace-nowrap">{{ formatClock(time) }} / {{ formatClock(duration) }}</span>

        <div class="flex-1"></div>

        <div class="hidden sm:flex items-center group">
          <button type="button" class="ctl" :aria-label="$t('player.volume')" @click="toggleMute">
            <VolumeX v-if="muted || volume === 0" class="w-[18px] h-[18px]" />
            <Volume1 v-else-if="volume < 0.5" class="w-[18px] h-[18px]" />
            <Volume2 v-else class="w-[18px] h-[18px]" />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="volume"
            :value="muted ? 0 : volume"
            :aria-label="$t('player.volume')"
            @input="setVolume(Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <button type="button" class="ctl text-[12px] font-bold tabular-nums" :class="speed !== 1 ? 'ctl-on' : ''" :title="$t('player.speed')" :aria-label="$t('player.speed')" @click="cycleSpeed">
          {{ speed }}×
        </button>
        <button type="button" class="ctl" :class="loop ? 'ctl-on' : ''" :title="$t('viewer.loop')" :aria-label="$t('viewer.loop')" :aria-pressed="loop" @click="loop = !loop">
          <Repeat class="w-[18px] h-[18px]" />
        </button>
        <button v-if="canPip" type="button" class="ctl" :title="$t('viewer.pip')" :aria-label="$t('viewer.pip')" @click="togglePip">
          <PictureInPicture2 class="w-[18px] h-[18px]" />
        </button>
        <button type="button" class="ctl" :title="$t('viewer.fullscreen')" :aria-label="$t('viewer.fullscreen')" @click="emit('fullscreen')">
          <Minimize v-if="fullscreen" class="w-[18px] h-[18px]" />
          <Maximize v-else class="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, Repeat, Volume1, Volume2, VolumeX } from 'lucide-vue-next'
import { formatClock } from '../audio/format'
import type { MediaItem } from './types'
import { centeredStyle, useFitSize, type PixelSize } from './useFitSize'

const SETTINGS_KEY = 'phi.video'
const SPEEDS = [1, 1.25, 1.5, 2, 0.5]

const props = defineProps<{ item: MediaItem; chrome: boolean; fullscreen: boolean }>()
const emit = defineEmits<{
  (e: 'playing' | 'pip', value: boolean): void
  (e: 'close' | 'fullscreen'): void
}>()

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return {
      volume: Number.isFinite(stored.volume) ? Math.min(1, Math.max(0, stored.volume)) : 1,
      muted: stored.muted === true
    }
  } catch {
    return { volume: 1, muted: false }
  }
}

const saved = loadSettings()

const box = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const natural = ref<PixelSize | null>(null)
// A video fills the room it has, like any player; its size is known once its header has loaded.
const fitted = useFitSize(box, natural, { maxUpscale: Infinity })
const track = ref<HTMLElement | null>(null)
const playing = ref(false)
const waiting = ref(false)
const time = ref(0)
const duration = ref(0)
const buffered = ref(0)
const volume = ref(saved.volume)
const muted = ref(saved.muted)
const speed = ref(1)
const loop = ref(false)
const hover = ref<{ ratio: number } | null>(null)

const canPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled
const progress = computed(() => (duration.value ? Math.min(1, time.value / duration.value) : 0))

function setPlaying(value: boolean) {
  playing.value = value
  emit('playing', value)
}

/** Recordings made in a browser often do not state their length until the end is reached. */
let findingLength = false

function onMetadata() {
  const element = video.value
  if (!element) return

  natural.value = { width: element.videoWidth, height: element.videoHeight }

  if (element.duration === Infinity) {
    findingLength = true
    element.currentTime = 1e7
  }
}

function onDuration() {
  const element = video.value
  const value = element?.duration ?? 0
  if (!element || !Number.isFinite(value)) return

  duration.value = value

  if (findingLength) {
    findingLength = false
    element.currentTime = 0
    void element.play().catch(() => {})
  }
}

function onProgress() {
  const element = video.value
  if (!element?.buffered.length || !duration.value) return
  buffered.value = element.buffered.end(element.buffered.length - 1) / duration.value
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume: volume.value, muted: muted.value })) } catch {}
}

function applySound() {
  if (!video.value) return
  video.value.volume = volume.value
  video.value.muted = muted.value
}

function setVolume(value: number) {
  volume.value = value
  muted.value = value === 0
  applySound()
  saveSettings()
}

function toggleMute() {
  muted.value = !muted.value
  applySound()
  saveSettings()
}

function cycleSpeed() {
  speed.value = SPEEDS[(SPEEDS.indexOf(speed.value) + 1) % SPEEDS.length]
  if (video.value) video.value.playbackRate = speed.value
}

async function toggle() {
  const element = video.value
  if (!element) return
  if (element.paused) {
    try { await element.play() } catch {}
  } else {
    element.pause()
  }
}

function seekTo(seconds: number) {
  const element = video.value
  if (!element) return
  element.currentTime = Math.min(duration.value || seconds, Math.max(0, seconds))
  time.value = element.currentTime
}

function seekBy(seconds: number) {
  seekTo(time.value + seconds)
}

function ratioAt(clientX: number) {
  const box = track.value?.getBoundingClientRect()
  return box ? Math.min(1, Math.max(0, (clientX - box.left) / box.width)) : 0
}

function onHover(event: PointerEvent) {
  hover.value = { ratio: ratioAt(event.clientX) }
}

function startSeek(event: PointerEvent) {
  seekTo(ratioAt(event.clientX) * duration.value)

  const onMove = (e: PointerEvent) => seekTo(ratioAt(e.clientX) * duration.value)
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

async function togglePip() {
  const element = video.value
  if (!element) return
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    else await element.requestPictureInPicture()
  } catch {}
}

let lastPause = 0

function onPause() {
  lastPause = Date.now()
  setPlaying(false)
}

/**
 * The floating window's close button pauses the video; its "back to tab" button does not. Closing
 * ends the viewing, going back shows the viewer again. The pause may land just after this event.
 */
function onLeavePip() {
  window.setTimeout(() => {
    const element = video.value
    const closed = !!element && element.paused && Date.now() - lastPause < 500
    emit('pip', false)
    if (closed) emit('close')
  }, 80)
}

function start() {
  findingLength = false
  natural.value = null
  time.value = 0
  duration.value = 0
  buffered.value = 0
  waiting.value = false
  applySound()
  if (video.value) video.value.playbackRate = speed.value
  void toggle()
}

onMounted(start)
watch(() => props.item.key, start, { flush: 'post' })

onBeforeUnmount(() => {
  emit('playing', false)
  if (document.pictureInPictureElement === video.value) void document.exitPictureInPicture().catch(() => {})
})

defineExpose({ toggle, seekBy, toggleMute })
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.big-play {
  @apply absolute w-16 h-16 grid place-items-center rounded-[35%] bg-accent/90 text-white shadow-xl hover:scale-105 active:scale-95 transition-transform;
}
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(.7); }
.pop-enter-active, .pop-leave-active { transition: opacity .14s ease, transform .18s cubic-bezier(.2, 1.3, .4, 1); }

.bar {
  @apply absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(46rem,calc(100%-1.5rem))] rounded-2xl px-2.5 pt-1.5 pb-1 bg-black/65 backdrop-blur-xl ring-1 ring-white/10 text-white transition duration-200;
}
.bar-hidden {
  @apply opacity-0 translate-y-2 pointer-events-none;
}
.ctl {
  @apply inline-grid place-items-center w-8 h-8 shrink-0 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition active:scale-90;
}
.ctl-on {
  @apply text-accent hover:text-accent;
}
.volume {
  @apply w-0 opacity-0 group-hover:w-20 group-hover:opacity-100 focus:w-20 focus:opacity-100 h-1 cursor-pointer;
  accent-color: var(--color-accent);
  transition: width .18s ease, opacity .18s ease;
}

.seek {
  @apply relative h-4 flex items-center cursor-pointer outline-none;
  touch-action: none;
}
.seek-line {
  @apply absolute left-0 h-1 w-full rounded-full bg-white/20 transition-[height];
}
.seek:hover .seek-line {
  @apply h-1.5;
}
.seek-knob {
  @apply absolute w-3 h-3 -ml-1.5 rounded-full bg-white shadow scale-0 transition-transform;
}
.seek:hover .seek-knob {
  @apply scale-100;
}
.seek-tip {
  @apply absolute bottom-full mb-1 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] tabular-nums pointer-events-none;
}
</style>
