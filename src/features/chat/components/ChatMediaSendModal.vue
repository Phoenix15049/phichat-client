<template>
  <ModalSheet :open="props.open" @close="emit('close')">
    <div class="p-5 w-[560px] max-w-full" dir="ltr">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-[#1B3C59]">Media</h3>
        <button class="btn-ghost" @click="emit('close')">✕</button>
      </div>

      <div class="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
        <div v-for="(file,index) in props.files" :key="`${file.name}-${file.lastModified}-${index}`" class="relative group">
          <img v-if="props.isImageFile(file)" :src="props.previewUrl(file)" class="w-full h-28 object-cover rounded-lg ring-1 ring-[#456173]/15"/>
          <video v-else :src="props.previewUrl(file)" class="w-full h-28 object-cover rounded-lg ring-1 ring-[#456173]/15"></video>
          <button class="absolute top-1 right-1 btn-ghost !bg-white/90 hover:!bg-white shadow" @click="emit('remove',index)">Remove</button>
        </div>
      </div>

      <label v-if="props.allImagesSelected" class="mt-3 flex items-center gap-2 text-sm text-[#456173]">
        <input type="checkbox" :checked="props.compressImages" @change="onCompressChange"/>
        <span>Compress images</span>
      </label>

      <label class="mt-2 flex items-center gap-2 text-sm text-[#456173]">
        <input type="checkbox" :checked="props.groupItems" @change="onGroupChange"/>
        <span>Group items</span>
      </label>

      <label class="block text-sm text-[#456173] mt-2 mb-1">Caption</label>
      <textarea
        :value="props.caption"
        rows="3"
        class="input w-full min-h-[84px]"
        placeholder="Write a caption…"
        @input="onCaptionInput"
      ></textarea>

      <div class="mt-4 flex items-center justify-between">
        <button class="btn-ghost" @click="emit('close')">Cancel</button>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="emit('add-more')">Add more</button>
          <button class="btn-primary" :disabled="props.sending || !props.files.length" @click="emit('send')">
            {{ props.sending ? 'Sending…' : `Send (${props.files.length})` }}
          </button>
        </div>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import ModalSheet from '../../../components/ModalSheet.vue'

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

function onCaptionInput(event: Event) {
  emit('update:caption', (event.target as HTMLTextAreaElement).value)
}

function onGroupChange(event: Event) {
  emit('update:groupItems', (event.target as HTMLInputElement).checked)
}

function onCompressChange(event: Event) {
  emit('update:compressImages', (event.target as HTMLInputElement).checked)
}
</script>