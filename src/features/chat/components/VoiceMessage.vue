<template>
  <div class="flex items-center gap-3 py-1 pe-1 min-w-[220px] max-w-[300px]" dir="ltr">
    <button
      type="button"
      class="w-11 h-11 shrink-0 rounded-full grid place-items-center bg-accent text-white hover:bg-accent-strong transition disabled:opacity-60"
      :disabled="!src"
      :aria-label="playing ? $t('chat.pause') : $t('chat.play')"
      @click.stop="toggle"
    >
      <Loader2 v-if="!src && state !== 'error'" class="w-5 h-5 animate-spin" />
      <AlertCircle v-else-if="state === 'error'" class="w-5 h-5" />
      <Pause v-else-if="playing" class="w-5 h-5" fill="currentColor" />
      <Play v-else class="w-5 h-5 translate-x-[1px]" fill="currentColor" />
    </button>

    <div class="flex-1 min-w-0">
      <!-- Waveform: played part in the accent color; click to seek -->
      <div
        class="h-8 flex items-center gap-[2px] cursor-pointer"
        role="slider"
        :aria-valuenow="Math.round(progress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        @click.stop="seek"
      >
        <span
          v-for="(height, i) in bars"
          :key="i"
          class="flex-1 rounded-full transition-colors"
          :class="i / bars.length < progress ? 'bg-accent' : 'bg-meta/40'"
          :style="{ height: `${Math.max(3, (height / 31) * 28)}px` }"
        ></span>
      </div>
      <div class="text-[11.5px] text-meta tabular-nums">
        {{ playing || current > 0 ? formatSeconds(current) : formatSeconds(duration) }}
      </div>
    </div>

    <audio
      ref="audio"
      :src="src || undefined"
      preload="metadata"
      class="hidden"
      @timeupdate="onTime"
      @ended="onEnded"
      @play="playing = true"
      @pause="playing = false"
    ></audio>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { AlertCircle, Loader2, Pause, Play } from 'lucide-vue-next'
import type { VoiceMeta } from '../../../services/e2ee/messageCodec'

const props = defineProps<{
  src: string | null
  voice: VoiceMeta
  state?: 'idle' | 'loading' | 'ready' | 'error'
}>()

const audio = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const current = ref(0)

const duration = computed(() => props.voice.duration || 0)
const progress = computed(() => (duration.value ? Math.min(1, current.value / duration.value) : 0))
const bars = computed(() => (props.voice.waveform.length ? props.voice.waveform : Array(40).fill(6)))

/** Only one voice message plays at a time. */
const PLAY_EVENT = 'phichat:voice-play'
function onOtherPlay(event: Event) {
  if ((event as CustomEvent).detail !== audio.value) audio.value?.pause()
}
window.addEventListener(PLAY_EVENT, onOtherPlay)
onBeforeUnmount(() => window.removeEventListener(PLAY_EVENT, onOtherPlay))

async function toggle() {
  const element = audio.value
  if (!element || !props.src) return
  if (element.paused) {
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: element }))
    try { await element.play() } catch {}
  } else {
    element.pause()
  }
}

function onTime() {
  current.value = audio.value?.currentTime ?? 0
}

function onEnded() {
  playing.value = false
  current.value = 0
}

function seek(event: MouseEvent) {
  const element = audio.value
  if (!element || !duration.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  element.currentTime = ratio * duration.value
  current.value = element.currentTime
  if (element.paused) void toggle()
}

function formatSeconds(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
</script>
