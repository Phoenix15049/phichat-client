<template>
  <div class="relative h-full w-full cursor-pointer group" @click.stop="emit('open')">
    <video
      :src="`${src}#t=0.1`"
      class="block"
      :class="fill ? 'w-full h-full object-cover' : ['bg-black max-h-[60vh] max-w-full sm:min-w-[220px] min-w-[160px] h-auto w-auto', flat ? '' : 'rounded-xl']"
      preload="metadata"
      muted
      playsinline
      @loadedmetadata="onMetadata"
    ></video>

    <span class="play"><Play class="w-5 h-5 translate-x-[1px]" fill="currentColor" /></span>
    <span v-if="duration" class="absolute top-1.5 start-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[11.5px] text-white tabular-nums backdrop-blur-sm" dir="ltr">
      {{ formatClock(duration) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Play } from 'lucide-vue-next'
import { formatClock } from '../../audio/format'

/** A still of a video; it plays in the media viewer. `fill` covers an album tile, `flat` fills a bubble. */
defineProps<{ src: string; fill?: boolean; flat?: boolean }>()
const emit = defineEmits<{ (e: 'open'): void }>()

const duration = ref(0)

function onMetadata(event: Event) {
  const value = (event.target as HTMLVideoElement).duration
  if (Number.isFinite(value)) duration.value = value
}
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.play {
  @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-[35%] bg-black/45 text-white backdrop-blur-sm pointer-events-none transition group-hover:bg-accent group-hover:scale-105;
}
</style>
