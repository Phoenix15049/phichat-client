<template>
  <!-- Photos and videos: a mosaic -->
  <div v-if="isMedia" class="album" :style="{ aspectRatio: `1 / ${layout.height}` }">
    <div
      v-for="(item, i) in items"
      :key="key(item)"
      :ref="bindMessageElement(key(item))"
      class="tile"
      :style="tileStyle(i)"
      @click.stop="onTileClick(item)"
      @contextmenu.stop.prevent="emit('context', $event, item)"
    >
      <template v-if="actions.mediaSrc(item)">
        <img v-if="actions.fileKind(item) === 'image'" :src="actions.mediaSrc(item)!" :alt="item.file?.name || ''" class="tile-media" draggable="false" />
        <ChatVideoThumb v-else fill :src="actions.mediaSrc(item)!" @open="onTileClick(item)" />
      </template>
      <div v-else class="absolute inset-0 grid place-items-center bg-black/10 text-muted">
        <ImageOff v-if="actions.mediaState(item) === 'error'" class="w-6 h-6" />
        <Loader2 v-else class="w-6 h-6 animate-spin" />
      </div>

      <!-- Still uploading, or failed -->
      <span v-if="item.status === 'sending'" class="absolute inset-0 grid place-items-center bg-black/25 text-white">
        <Loader2 class="w-6 h-6 animate-spin" />
      </span>
      <button
        v-else-if="item.status === 'failed'"
        type="button"
        class="absolute inset-0 grid place-items-center bg-black/45 text-white"
        :aria-label="$t('chat.retry')"
        @click.stop="actions.retrySend(item)"
      >
        <RotateCw class="w-6 h-6" />
      </button>

      <span
        v-if="selectionMode"
        class="absolute top-1.5 start-1.5 w-5 h-5 grid place-items-center rounded-full border-2 transition"
        :class="actions.isSelected(item) ? 'bg-accent border-accent text-white' : 'border-white/90 bg-black/25'"
      ><Check v-if="actions.isSelected(item)" class="w-3 h-3" :stroke-width="3" /></span>
    </div>
  </div>

  <!-- Files: one list under a shared caption -->
  <div v-else class="flex flex-col gap-0.5">
    <div
      v-for="item in items"
      :key="key(item)"
      :ref="bindMessageElement(key(item))"
      class="relative rounded-lg"
      :class="selectionMode && actions.isSelected(item) ? 'bg-accent/15' : ''"
      @click="selectionMode ? (actions.toggleSelect(item), $event.stopPropagation()) : undefined"
      @contextmenu.stop.prevent="emit('context', $event, item)"
    >
      <MusicMessage
        v-if="actions.fileKind(item) === 'audio' && item.file"
        :track-key="key(item)"
        :file="item.file"
        :human-file-size="actions.humanFileSize"
        :downloading="downloading[actions.fileKey(item)]"
        :downloaded="downloaded[actions.fileKey(item)]"
        @play="actions.playAudio(item)"
        @download="actions.downloadFile(item)"
      />
      <div v-else class="flex items-center gap-3 py-1 pe-2 min-w-[200px]">
        <button
          type="button"
          class="w-11 h-11 shrink-0 rounded-[35%] grid place-items-center bg-accent text-white hover:bg-accent-strong transition"
          :aria-label="$t('chat.download')"
          @click.stop="actions.downloadFile(item)"
        >
          <Loader2 v-if="downloading[actions.fileKey(item)] || item.status === 'sending'" class="w-5 h-5 animate-spin" />
          <Check v-else-if="downloaded[actions.fileKey(item)]" class="w-5 h-5" />
          <FileDown v-else class="w-5 h-5" />
        </button>
        <div class="flex-1 min-w-0 text-start">
          <div class="font-medium truncate max-w-[16rem]" dir="auto">{{ item.file?.name || actions.fileNameFromUrl(item.fileUrl!) }}</div>
          <div class="text-[12px] text-meta">{{ actions.humanFileSize(item.file?.size || 0) }}</div>
        </div>
        <button v-if="item.status === 'failed'" type="button" class="text-danger" :aria-label="$t('chat.retry')" @click.stop="actions.retrySend(item)">
          <RotateCw class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { Check, FileDown, ImageOff, Loader2, RotateCw } from 'lucide-vue-next'
import type { UiMessage } from '../../../types/chat'
import { albumLayout } from '../albumLayout'
import ChatVideoThumb from './ChatVideoThumb.vue'
import MusicMessage from './MusicMessage.vue'

const props = defineProps<{
  items: UiMessage[]
  selectionMode: boolean
  downloaded: Record<string, boolean>
  downloading: Record<string, boolean>
  bindMessageElement: (key: string) => (element: Element | ComponentPublicInstance | null) => void
  actions: {
    fileKind: (message: UiMessage) => 'image' | 'video' | 'voice' | 'audio' | 'file'
    mediaSrc: (message: UiMessage) => string | null
    mediaState: (message: UiMessage) => 'idle' | 'loading' | 'ready' | 'error'
    openImage: (message: UiMessage) => void
    openVideo: (message: UiMessage) => void
    isSelected: (message: UiMessage) => boolean
    toggleSelect: (message: UiMessage) => void
    retrySend: (message: UiMessage) => void
    downloadFile: (message: UiMessage) => void | Promise<void>
    playAudio: (message: UiMessage) => void
    fileKey: (message: UiMessage) => string
    fileNameFromUrl: (url: string) => string
    humanFileSize: (bytes: number) => string
  }
}>()

const emit = defineEmits<{ (e: 'context', event: MouseEvent, message: UiMessage): void }>()

const key = (message: UiMessage) => (message.id || message.clientId)!

const isMedia = computed(() => props.items.every(item => ['image', 'video'].includes(props.actions.fileKind(item))))

const layout = computed(() => albumLayout(props.items.map(item => {
  const { width, height } = item.file ?? {}
  return width && height ? width / height : 1
})))

function tileStyle(index: number) {
  const tile = layout.value.tiles[index]
  const percent = (value: number) => `${value * 100}%`
  return {
    insetInlineStart: percent(tile.x),
    top: percent(tile.y / layout.value.height),
    width: percent(tile.w),
    height: percent(tile.h / layout.value.height)
  }
}

function onTileClick(item: UiMessage) {
  if (props.selectionMode) props.actions.toggleSelect(item)
  else if (props.actions.fileKind(item) === 'image') props.actions.openImage(item)
  else props.actions.openVideo(item)
}
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.album {
  @apply relative overflow-hidden rounded-[var(--bubble-radius)];
  width: min(25rem, 72vw);
}
/* The gap between tiles comes from the tiles themselves, so the mosaic has no outer margin. */
.tile {
  @apply absolute overflow-hidden cursor-pointer;
  border: 1px solid transparent;
  background-clip: padding-box;
}
.tile-media {
  @apply block w-full h-full object-cover select-none transition-transform duration-300;
  border-radius: 3px;
}
.tile:hover .tile-media {
  transform: scale(1.025);
}
</style>
