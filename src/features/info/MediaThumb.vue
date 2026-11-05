<template>
  <button ref="root" type="button" class="thumb group" :aria-label="message.file?.name || ''" @click="emit('open')">
    <template v-if="src">
      <img v-if="video === false" :src="src" alt="" class="thumb-media" draggable="false" />
      <video v-else :src="`${src}#t=0.1`" class="thumb-media" muted playsinline preload="metadata"></video>
    </template>
    <span v-else class="absolute inset-0 grid place-items-center text-muted">
      <ImageOff v-if="actions.mediaState(message) === 'error'" class="w-5 h-5" />
      <Loader2 v-else class="w-5 h-5 animate-spin" />
    </span>

    <span v-if="video" class="absolute bottom-1 start-1 w-6 h-6 grid place-items-center rounded-[35%] bg-black/50 text-white backdrop-blur-sm">
      <Play class="w-3 h-3" fill="currentColor" />
    </span>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ImageOff, Loader2, Play } from 'lucide-vue-next'
import type { UiMessage } from '../../types/chat'
import type { InfoActions } from './types'

const props = defineProps<{ message: UiMessage; actions: InfoActions }>()
const emit = defineEmits<{ (e: 'open'): void }>()

const root = ref<HTMLElement | null>(null)
const src = computed(() => props.actions.mediaSrc(props.message))
const video = computed(() => props.actions.fileKind(props.message) === 'video')

// Decrypted only once it comes into view: a chat can hold thousands.
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    props.actions.ensureMedia(props.message)
    observer?.disconnect()
  }, { rootMargin: '200px' })
  if (root.value) observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.thumb {
  @apply relative block aspect-square overflow-hidden bg-surface-2;
}
.thumb-media {
  @apply block w-full h-full object-cover select-none transition-transform duration-300;
}
.thumb:hover .thumb-media {
  transform: scale(1.05);
}
</style>
