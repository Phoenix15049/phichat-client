<template>
  <div class="flex items-center gap-3 py-1 pe-1 min-w-[220px] max-w-[320px]">
    <button
      type="button"
      class="relative w-12 h-12 shrink-0 rounded-[35%] overflow-hidden grid place-items-center bg-accent text-white transition active:scale-95"
      :aria-label="playing ? $t('chat.pause') : $t('chat.play')"
      @click.stop="emit('play')"
    >
      <img v-if="cover" :src="cover" alt="" class="absolute inset-0 w-full h-full object-cover" />
      <span class="absolute inset-0 grid place-items-center" :class="cover ? 'bg-black/30' : ''">
        <Loader2 v-if="active && state.loading" class="w-5 h-5 animate-spin" />
        <AlertCircle v-else-if="active && state.failed" class="w-5 h-5" />
        <Pause v-else-if="playing" class="w-5 h-5" fill="currentColor" />
        <Play v-else class="w-5 h-5 translate-x-[1px]" fill="currentColor" />
      </span>
    </button>

    <div class="flex-1 min-w-0 text-start">
      <div class="truncate text-[calc(var(--chat-font-size)-.5px)]">
        <bdi><b v-if="performer" class="font-semibold">{{ performer }}</b><template v-if="performer"> – </template><span :class="performer ? '' : 'font-semibold'">{{ title }}</span></bdi>
      </div>
      <div class="text-[12px] text-meta tabular-nums">
        <bdi dir="ltr">{{ active ? `${formatClock(state.time)} / ${formatClock(state.duration)}` : info }}</bdi>
      </div>
    </div>

    <button
      type="button"
      class="w-8 h-8 shrink-0 grid place-items-center rounded-full text-meta hover:text-accent hover:bg-accent/10 transition"
      :aria-label="$t('chat.download')"
      @click.stop="emit('download')"
    >
      <Loader2 v-if="downloading" class="w-4 h-4 animate-spin" />
      <Check v-else-if="downloaded" class="w-4 h-4" />
      <Download v-else class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Check, Download, Loader2, Pause, Play } from 'lucide-vue-next'
import type { FileMeta } from '../../../services/e2ee/messageCodec'
import { formatClock } from '../../audio/format'
import { useAudioPlayer } from '../../audio/useAudioPlayer'

const props = defineProps<{
  trackKey: string
  file: FileMeta
  humanFileSize: (bytes: number) => string
  downloading?: boolean
  downloaded?: boolean
}>()

const emit = defineEmits<{ (e: 'play'): void; (e: 'download'): void }>()

const { state } = useAudioPlayer()

const active = computed(() => state.current?.key === props.trackKey)
const playing = computed(() => active.value && state.playing)
const cover = computed(() => props.file.audio?.cover ?? null)
const performer = computed(() => props.file.audio?.performer ?? '')
const title = computed(() => props.file.audio?.title || props.file.name.replace(/\.[^.]+$/, ''))
const info = computed(() => {
  const duration = props.file.audio?.duration
  return [duration ? formatClock(duration) : '', props.humanFileSize(props.file.size)].filter(Boolean).join(', ')
})
</script>
