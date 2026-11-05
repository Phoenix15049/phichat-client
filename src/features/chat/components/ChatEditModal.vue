<template>
  <ModalSheet :open="!!props.items" @close="emit('close')">
    <div v-if="props.items" class="flex flex-col max-h-[90dvh]">
      <div class="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h3 class="flex-1 min-w-0 text-[17px] font-bold text-ink truncate">
          {{ entries.length > 1 ? $t('chat.editAlbum') : $t('chat.editMessage') }}
        </h3>
        <button type="button" class="icon-btn w-9 h-9" :aria-label="$t('common.close')" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-1">
        <!-- Photos and videos: the mosaic as it appears in the chat, every tile can be swapped -->
        <div v-if="isMedia" class="mosaic" :style="{ aspectRatio: `1 / ${layout.height}` }">
          <div
            v-for="(entry, i) in entries"
            :key="entry.key"
            class="tile group"
            :class="[dropKey === entry.key ? 'tile-drop' : '', entry.file ? 'tile-new' : '']"
            :style="tileStyle(i)"
            @dragenter.prevent="dropKey = entry.key"
            @dragover.prevent
            @dragleave="onDragLeave($event, entry.key)"
            @drop.prevent="onDrop($event, entry)"
          >
            <template v-if="entry.src">
              <img v-if="entry.kind === 'image'" :src="entry.src" alt="" class="w-full h-full object-cover" draggable="false" />
              <video v-else :src="`${entry.src}#t=0.1`" class="w-full h-full object-cover" muted playsinline preload="metadata"></video>
            </template>
            <div v-else class="w-full h-full grid place-items-center bg-surface-2 text-muted"><Loader2 class="w-5 h-5 animate-spin" /></div>

            <button type="button" class="tile-swap" :title="$t('chat.replaceMedia')" :aria-label="$t('chat.replaceMedia')" @click="pick(entry)">
              <span class="swap-chip"><Replace class="w-4 h-4" /><span v-if="tileIsWide(i)">{{ $t('chat.replaceMedia') }}</span></span>
            </button>
            <button v-if="entry.file" type="button" class="tile-undo" :title="$t('chat.undoReplace')" :aria-label="$t('chat.undoReplace')" @click="undo(entry)">
              <Undo2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Files, music and voice: one row each -->
        <ul v-else class="space-y-1.5">
          <li
            v-for="entry in entries"
            :key="entry.key"
            class="file-row"
            :class="[dropKey === entry.key ? 'tile-drop' : '', entry.file ? 'file-row-new' : '']"
            @dragenter.prevent="canReplace(entry) && (dropKey = entry.key)"
            @dragover.prevent
            @dragleave="onDragLeave($event, entry.key)"
            @drop.prevent="onDrop($event, entry)"
          >
            <span class="w-11 h-11 shrink-0 rounded-[35%] grid place-items-center bg-accent/15 text-accent">
              <component :is="iconOf(entry)" class="w-5 h-5" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-[14px] font-medium text-ink truncate" dir="auto">{{ entry.name }}</span>
              <span class="block text-[12px] text-muted">{{ props.humanFileSize(entry.size) }}</span>
            </span>
            <button v-if="entry.file" type="button" class="icon-btn w-9 h-9" :title="$t('chat.undoReplace')" :aria-label="$t('chat.undoReplace')" @click="undo(entry)">
              <Undo2 class="w-4 h-4" />
            </button>
            <button v-if="canReplace(entry)" type="button" class="btn-secondary gap-1.5 px-3 py-1.5 text-[13px]" @click="pick(entry)">
              <Replace class="w-4 h-4" /><span>{{ $t('chat.replaceFile') }}</span>
            </button>
          </li>
        </ul>

        <p v-if="canReplaceAny" class="mt-2 text-[12px] text-muted">{{ isMedia ? $t('chat.replaceHintMedia') : $t('chat.replaceHintFile') }}</p>

        <div class="mt-3 relative">
          <textarea
            ref="captionInput"
            v-model="caption"
            rows="2"
            dir="auto"
            maxlength="4000"
            class="input w-full text-start auto-dir resize-none"
            :placeholder="entries.length > 1 ? $t('chat.writeSharedCaption') : $t('chat.writeCaption')"
            @keydown.enter.exact.prevent="submit"
          ></textarea>
        </div>

        <SettingToggle
          v-if="replacedImage"
          v-model="compress"
          class="mt-1"
          :label="$t('chat.compressImages')"
        />

        <p v-if="props.error" class="mt-2 text-sm text-danger">{{ props.error }}</p>
      </div>

      <div class="flex items-center justify-end gap-2 px-4 py-3">
        <span v-if="props.progress && props.progress.total > 1" class="me-auto text-[12.5px] text-muted tabular-nums">
          {{ props.progress.done }} / {{ props.progress.total }}
        </span>
        <button type="button" class="btn-ghost px-4 py-2" :disabled="props.saving" @click="emit('close')">{{ $t('common.cancel') }}</button>
        <button type="button" class="btn-primary gap-1.5 min-w-[6rem]" :disabled="props.saving || !changed" @click="submit">
          <Loader2 v-if="props.saving" class="w-4 h-4 animate-spin" />
          <span>{{ $t('common.save') }}</span>
        </button>
      </div>

      <input ref="filePicker" type="file" class="hidden" :accept="pickAccept" @change="onPicked" />
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { FileText, Loader2, Mic, Music, Replace, Undo2, X } from 'lucide-vue-next'
import ModalSheet from '../../../components/ModalSheet.vue'
import SettingToggle from '../../settings/SettingToggle.vue'
import type { UiMessage } from '../../../types/chat'
import { albumLayout } from '../albumLayout'
import type { EditChange } from '../composables/useMessageEditor'
import type { FileKind } from '../composables/useSecureFiles'

const props = defineProps<{
  /** What is being edited; null when the editor is closed. */
  items: UiMessage[] | null
  saving: boolean
  progress: { done: number; total: number } | null
  error: string | null
  fileKind: (message: UiMessage) => FileKind
  mediaSrc: (message: UiMessage) => string | null
  humanFileSize: (bytes: number) => string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', change: EditChange): void
}>()

type Choice = { file: File; url: string; ratio: number }

const caption = ref('')
const compress = ref(true)
const captionInput = ref<HTMLTextAreaElement | null>(null)
const filePicker = ref<HTMLInputElement | null>(null)
const choices = ref(new Map<string, Choice>())
const dropKey = ref<string | null>(null)
const pickFor = ref<string | null>(null)

const keyOf = (message: UiMessage) => (message.id || message.clientId)!

const originalCaption = computed(() => props.items?.find(item => item.plainText)?.plainText ?? '')

function clearChoices() {
  for (const choice of choices.value.values()) URL.revokeObjectURL(choice.url)
  choices.value = new Map()
}

watch(() => props.items, async items => {
  clearChoices()
  dropKey.value = null
  if (!items) return

  caption.value = originalCaption.value
  compress.value = true
  await nextTick()
  captionInput.value?.focus()
}, { immediate: true })

onBeforeUnmount(clearChoices)

/** What an item shows now: the file chosen for it, or its current one. */
const entries = computed(() => (props.items ?? []).map(message => {
  const key = keyOf(message)
  const choice = choices.value.get(key)
  const kind: FileKind = choice ? kindOfFile(choice.file) : props.fileKind(message)
  return {
    key,
    message,
    kind,
    file: choice?.file ?? null,
    src: choice?.url ?? props.mediaSrc(message),
    name: choice?.file.name ?? message.file?.name ?? '',
    size: choice?.file.size ?? message.file?.size ?? 0,
    ratio: choice?.ratio ?? (message.file?.width && message.file.height ? message.file.width / message.file.height : 1)
  }
}))

type Entry = (typeof entries.value)[number]

function kindOfFile(file: File): FileKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'file'
}

/** Photos and videos are swapped for photos and videos; a file for any file. */
const isMedia = computed(() => !!props.items?.length && props.items.every(item => ['image', 'video'].includes(props.fileKind(item))))
const pickAccept = computed(() => (isMedia.value ? 'image/*,video/*' : ''))

const canReplace = (entry: Entry) => props.fileKind(entry.message) !== 'voice'
const canReplaceAny = computed(() => entries.value.some(canReplace))

const replacedImage = computed(() => entries.value.some(entry => entry.file?.type.startsWith('image/')))
const changed = computed(() => choices.value.size > 0 || caption.value.trim() !== originalCaption.value)

const layout = computed(() => albumLayout(entries.value.map(entry => entry.ratio)))

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

const tileIsWide = (index: number) => layout.value.tiles[index].w > 0.45

function iconOf(entry: Entry) {
  if (entry.kind === 'voice') return Mic
  return entry.kind === 'audio' ? Music : FileText
}

function pick(entry: Entry) {
  pickFor.value = entry.key
  filePicker.value?.click()
}

function onPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && pickFor.value) void choose(pickFor.value, file)
}

function onDrop(event: DragEvent, entry: Entry) {
  dropKey.value = null
  const file = event.dataTransfer?.files?.[0]
  if (!file || !canReplace(entry)) return
  if (isMedia.value && !['image', 'video'].includes(kindOfFile(file))) return
  void choose(entry.key, file)
}

function onDragLeave(event: DragEvent, key: string) {
  const within = (event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)
  if (!within && dropKey.value === key) dropKey.value = null
}

/** Width / height of a chosen picture or video, for the mosaic. */
function measure(file: File, url: string): Promise<number> {
  return new Promise(resolve => {
    if (file.type.startsWith('image/')) {
      const image = new Image()
      image.onload = () => resolve(image.naturalWidth / image.naturalHeight || 1)
      image.onerror = () => resolve(1)
      image.src = url
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => resolve(video.videoWidth / video.videoHeight || 1)
      video.onerror = () => resolve(1)
      video.src = url
    } else {
      resolve(1)
    }
  })
}

async function choose(key: string, file: File) {
  const url = URL.createObjectURL(file)
  const ratio = await measure(file, url)

  const next = new Map(choices.value)
  const previous = next.get(key)
  if (previous) URL.revokeObjectURL(previous.url)
  next.set(key, { file, url, ratio })
  choices.value = next
}

function undo(entry: Entry) {
  const next = new Map(choices.value)
  const choice = next.get(entry.key)
  if (choice) URL.revokeObjectURL(choice.url)
  next.delete(entry.key)
  choices.value = next
}

function submit() {
  if (props.saving || !changed.value) return
  emit('save', {
    caption: caption.value,
    compress: compress.value,
    replacements: entries.value.filter(entry => entry.file).map(entry => ({ message: entry.message, file: entry.file! }))
  })
}
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.mosaic {
  @apply relative overflow-hidden rounded-2xl bg-surface-2 max-h-[52vh] mx-auto;
  max-width: 100%;
}
.tile {
  @apply absolute overflow-hidden;
  border: 1px solid var(--color-surface);
}
.tile-new {
  box-shadow: inset 0 0 0 2px var(--color-accent);
}
.tile-drop {
  outline: 2px dashed var(--color-accent);
  outline-offset: -4px;
}
/* Always visible on touch screens; on a mouse the tile answers to the pointer. */
.tile-swap {
  @apply absolute inset-0 grid place-items-center bg-black/25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity;
}
.swap-chip {
  @apply inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition active:scale-95;
}
.tile-swap:hover .swap-chip {
  @apply bg-accent;
}
.tile-undo {
  @apply absolute top-1.5 end-1.5 w-7 h-7 grid place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 transition;
}
.file-row {
  @apply flex items-center gap-3 rounded-2xl bg-surface-2/70 p-2.5 transition;
}
.file-row-new {
  box-shadow: inset 0 0 0 2px var(--color-accent);
}
</style>
