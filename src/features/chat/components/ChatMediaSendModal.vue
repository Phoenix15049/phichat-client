<template>
  <ModalSheet :open="props.open" @close="emit('close')">
    <div class="p-5 w-[520px] max-w-full">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-ink">
          {{ $t('chat.mediaSelected', { count: props.files.length }, props.files.length) }}
        </h3>
        <button type="button" class="icon-btn w-8 h-8" :aria-label="$t('common.close')" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- As an album: shown the way it will look in the chat -->
      <div v-if="asAlbum" class="max-h-[52vh] overflow-y-auto pe-0.5 space-y-2">
        <div
          v-for="(chunk, c) in chunks"
          :key="c"
          class="relative overflow-hidden rounded-2xl bg-surface-2"
          :style="{ aspectRatio: `1 / ${chunk.layout.height}` }"
        >
          <div
            v-for="(entry, i) in chunk.entries"
            :key="entry.key"
            class="tile group"
            :style="tileStyle(chunk.layout, i)"
          >
            <img v-if="props.isImageFile(entry.file)" :src="props.previewUrl(entry.file)" alt="" class="w-full h-full object-cover" />
            <video v-else :src="props.previewUrl(entry.file)" class="w-full h-full object-cover" muted preload="metadata"></video>
            <button type="button" class="remove" :aria-label="$t('common.remove')" @click="emit('remove', entry.index)">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Separately: a plain grid -->
      <div v-else class="grid grid-cols-3 gap-1.5 max-h-[52vh] overflow-y-auto">
        <div v-for="entry in entries" :key="entry.key" class="relative aspect-square overflow-hidden rounded-xl group">
          <img v-if="props.isImageFile(entry.file)" :src="props.previewUrl(entry.file)" alt="" class="w-full h-full object-cover" />
          <video v-else :src="props.previewUrl(entry.file)" class="w-full h-full object-cover" muted preload="metadata"></video>
          <button type="button" class="remove" :aria-label="$t('common.remove')" @click="emit('remove', entry.index)">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="mt-3 space-y-1">
        <SettingToggle
          v-if="props.files.length > 1"
          :model-value="props.groupItems"
          :label="$t('chat.groupItems')"
          :description="$t('chat.groupItemsHint', { max: MAX_ALBUM_ITEMS })"
          @update:model-value="value => emit('update:groupItems', value)"
        />
        <SettingToggle
          v-if="hasImages"
          :model-value="props.compressImages"
          :label="$t('chat.compressImages')"
          @update:model-value="value => emit('update:compressImages', value)"
        />
      </div>

      <textarea
        :value="props.caption"
        rows="2"
        dir="auto"
        class="input w-full mt-3 text-start auto-dir resize-none"
        :placeholder="props.groupItems && props.files.length > 1 ? $t('chat.writeSharedCaption') : $t('chat.writeCaption')"
        @input="onCaptionInput"
        @keydown.enter.exact.prevent="emit('send')"
      ></textarea>

      <div class="mt-4 flex items-center justify-between">
        <button type="button" class="btn-outline" @click="emit('add-more')">{{ $t('chat.addMore') }}</button>
        <div class="flex items-center gap-2">
          <button type="button" class="btn-ghost" @click="emit('close')">{{ $t('common.cancel') }}</button>
          <button type="button" class="btn-primary" :disabled="props.sending || !props.files.length" @click="emit('send')">
            {{ props.sending ? $t('common.sending') : $t('chat.sendCount', { count: props.files.length }) }}
          </button>
        </div>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import ModalSheet from '../../../components/ModalSheet.vue'
import SettingToggle from '../../settings/SettingToggle.vue'
import { albumLayout, MAX_ALBUM_ITEMS, type AlbumLayout } from '../albumLayout'

const props = defineProps<{
  open: boolean
  files: File[]
  caption: string
  sending: boolean
  groupItems: boolean
  compressImages: boolean
  allImagesSelected: boolean
  isImageFile: (file: File) => boolean
  previewUrl: (file: File) => string
}>()

const emit = defineEmits<{
  (event: 'update:caption', value: string): void
  (event: 'update:groupItems', value: boolean): void
  (event: 'update:compressImages', value: boolean): void
  (event: 'remove', index: number): void
  (event: 'close' | 'add-more' | 'send'): void
}>()

const asAlbum = computed(() => props.groupItems && props.files.length > 1)
const hasImages = computed(() => props.files.some(props.isImageFile))

/** Width / height of the chosen pictures, known once each has loaded. */
const ratios = ref(new WeakMap<File, number>())
const measured = ref(0)

function measure(file: File) {
  if (ratios.value.has(file)) return
  ratios.value.set(file, 1)

  const url = props.previewUrl(file)
  const done = (width: number, height: number) => {
    if (!width || !height) return
    ratios.value.set(file, width / height)
    measured.value++
  }

  if (props.isImageFile(file)) {
    const image = new Image()
    image.onload = () => done(image.naturalWidth, image.naturalHeight)
    image.src = url
  } else {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight)
    video.src = url
  }
}

watch(() => props.files.length, () => props.files.forEach(measure), { immediate: true })

const entries = computed(() => props.files.map((file, index) => ({ file, index, key: `${file.name}-${file.lastModified}-${index}` })))

const chunks = computed(() => {
  void measured.value
  const result: Array<{ entries: typeof entries.value; layout: AlbumLayout }> = []
  for (let start = 0; start < entries.value.length; start += MAX_ALBUM_ITEMS) {
    const part = entries.value.slice(start, start + MAX_ALBUM_ITEMS)
    result.push({ entries: part, layout: albumLayout(part.map(entry => ratios.value.get(entry.file) ?? 1)) })
  }
  return result
})

function tileStyle(layout: AlbumLayout, index: number) {
  const tile = layout.tiles[index]
  const percent = (value: number) => `${value * 100}%`
  return {
    insetInlineStart: percent(tile.x),
    top: percent(tile.y / layout.height),
    width: percent(tile.w),
    height: percent(tile.h / layout.height)
  }
}

function onCaptionInput(event: Event) {
  emit('update:caption', (event.target as HTMLTextAreaElement).value)
}
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.tile {
  @apply absolute overflow-hidden;
  border: 1px solid transparent;
  background-clip: padding-box;
}
.remove {
  @apply absolute top-1.5 end-1.5 w-7 h-7 grid place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:bg-black/70 transition;
}
</style>
