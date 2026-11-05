<template>
  <div class="flex items-center gap-3 py-1 pe-1 min-w-[220px] max-w-[300px]" dir="ltr">
    <button
      type="button"
      class="w-11 h-11 shrink-0 rounded-full grid place-items-center bg-accent text-white hover:bg-accent-strong transition"
      :aria-label="playing ? $t('chat.pause') : $t('chat.play')"
      @click.stop="emit('play')"
    >
      <Loader2 v-if="active && state.loading" class="w-5 h-5 animate-spin" />
      <AlertCircle v-else-if="active && state.failed" class="w-5 h-5" />
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
        {{ active ? `${formatClock(state.time)} / ${formatClock(duration)}` : formatClock(duration) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Loader2, Pause, Play } from 'lucide-vue-next'
import type { VoiceMeta } from '../../../services/e2ee/messageCodec'
import { formatClock } from '../../audio/format'
import { useAudioPlayer } from '../../audio/useAudioPlayer'

const props = defineProps<{
  /** Identifies this message in the player. */
  trackKey: string
  voice: VoiceMeta
}>()

const emit = defineEmits<{ (e: 'play'): void }>()

const player = useAudioPlayer()
const { state } = player

const active = computed(() => state.current?.key === props.trackKey)
const playing = computed(() => active.value && state.playing)
const duration = computed(() => props.voice.duration || 0)
const progress = computed(() => (active.value && duration.value ? Math.min(1, state.time / duration.value) : 0))
const bars = computed(() => (props.voice.waveform.length ? props.voice.waveform : Array(40).fill(6)))

function seek(event: MouseEvent) {
  // Playback starts from the top; seeking applies to the message that is loaded.
  if (!active.value) {
    emit('play')
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  player.seekRatio(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)))
}
</script>
