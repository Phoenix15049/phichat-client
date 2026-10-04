<template>
  <!-- Reply Banner -->
  <div
    v-if="props.replying"
    class="px-4 pt-2"
  >
    <div
      class="px-3 py-2 bg-gray-100 border-l-4 border-blue-500 text-xs flex items-center justify-between rounded"
    >
      <div class="truncate">
        Replying to:
        {{ props.replyPreview }}
      </div>

      <button
        type="button"
        class="text-gray-500 hover:text-red-600"
        @click="emit('cancel-reply')"
      >
        ✕
      </button>
    </div>
  </div>

  <!-- Edit Banner -->
  <div
    v-if="props.editing"
    class="px-4 pt-2"
  >
    <div
      class="px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 text-xs flex items-center justify-between rounded"
    >
      <div class="truncate">
        Editing message
      </div>

      <button
        type="button"
        class="text-gray-500 hover:text-red-600"
        @click="emit('cancel-edit')"
      >
        ✕
      </button>
    </div>
  </div>

  <!-- Composer -->
  <form
    v-if="props.visible"
    class="composer p-2 border-t border-gray-100"
    @submit.prevent="emit('send')"
  >
    <div
      class="relative flex items-end gap-1 rounded-2xl bg-white ring-1 ring-[#456173]/15 px-1 py-1 shadow-sm focus-within:ring-[#11BFAE]/40"
    >
      <!-- Attach -->
      <div
        class="relative"
        @mouseenter="clipHover = true"
        @mouseleave="clipHover = false"
      >
        <button
          type="button"
          class="p-1 rounded-full text-[#456173] hover:text-[#1B3C59] hover:bg-black/5"
          title="Attach"
          aria-label="Attach"
          @click="emit('open-file')"
        >
          <Paperclip class="w-6 h-6" />
        </button>

        <Transition name="clip-pop">
          <div
            v-if="clipHover || menuHover"
            class="absolute bottom-full right-0 mb-1 w-44 bg-white border rounded-xl shadow-lg z-50 overflow-hidden"
            @mouseenter="menuHover = true"
            @mouseleave="menuHover = false"
          >
            <button
              v-ripple
              type="button"
              class="block w-full text-left px-3 py-2 hover:bg-gray-50"
              @click="emit('open-file')"
            >
              File
            </button>

            <button
              v-ripple
              type="button"
              class="px-3 py-2 hover:bg-gray-100 w-full text-left"
              @click="emit('open-media')"
            >
              Photo &amp; Video
            </button>
          </div>
        </Transition>
      </div>

      <!-- Hidden inputs -->
      <input
        :ref="bindFileInput"
        type="file"
        class="hidden"
        multiple
        @change="
          emit(
            'files-chosen',
            $event
          )
        "
      />

      <input
        :ref="bindMediaInput"
        type="file"
        class="hidden"
        multiple
        accept="image/*,video/*"
        @change="
          emit(
            'media-chosen',
            $event
          )
        "
      />

      <!-- Message textarea -->
      <textarea
        :ref="bindMessageInput"
        :value="props.modelValue"
        rows="1"
        dir="auto"
        placeholder="Write a message…"
        class="tg-text tg-fade flex-1 min-w-0 bg-transparent border-0 pl-1 px-2 py-2 leading-6 resize-none overflow-y-auto box-border will-change-[height] outline-none placeholder:text-gray-400"
        style="transition: height .14s ease;"
        @keydown.enter.exact.prevent="
          emit('send')
        "
        @input="handleInput"
        @blur="
          emit('composer-blur')
        "
      />

      <!-- Send -->
      <button
        type="submit"
        class="tg-send w-10 h-10 rounded-full grid place-items-center bg-[#11BFAE] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!props.canSend"
      >
        <SendHorizontal class="w-5 h-5" />
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import {
  ref,
  type ComponentPublicInstance
} from 'vue'

import {
  Paperclip,
  SendHorizontal
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  visible: boolean
  canSend: boolean

  replying: boolean
  replyPreview: string

  editing: boolean

  setMessageInput: (
    element:
      HTMLTextAreaElement | null
  ) => void

  setFileInput: (
    element:
      HTMLInputElement | null
  ) => void

  setMediaInput: (
    element:
      HTMLInputElement | null
  ) => void
}>()

const emit = defineEmits<{
  (
    event: 'update:modelValue',
    value: string
  ): void

  (event: 'send'): void
  (event: 'composer-blur'): void
  (event: 'open-file'): void
  (event: 'open-media'): void
  (event: 'cancel-reply'): void
  (event: 'cancel-edit'): void

  (
    event: 'composer-input',
    value: Event
  ): void

  (
    event: 'files-chosen',
    value: Event
  ): void

  (
    event: 'media-chosen',
    value: Event
  ): void
}>()

const clipHover = ref(false)
const menuHover = ref(false)

function handleInput(event: Event) {
  const element =
    event.target as HTMLTextAreaElement

  emit(
    'update:modelValue',
    element.value
  )

  emit(
    'composer-input',
    event
  )
}

function bindMessageInput(
  element:
    Element |
    ComponentPublicInstance |
    null
) {
  props.setMessageInput(
    element instanceof
      HTMLTextAreaElement
      ? element
      : null
  )
}

function bindFileInput(
  element:
    Element |
    ComponentPublicInstance |
    null
) {
  props.setFileInput(
    element instanceof
      HTMLInputElement
      ? element
      : null
  )
}

function bindMediaInput(
  element:
    Element |
    ComponentPublicInstance |
    null
) {
  props.setMediaInput(
    element instanceof
      HTMLInputElement
      ? element
      : null
  )
}

</script>

<style scoped>
.composer textarea {
  resize: none !important;
  overflow-y: auto;
}
.composer textarea::-webkit-resizer { display: none; } 


.tg-text{
  -ms-overflow-style: none;   /* IE/Edge legacy */
  scrollbar-width: none;      /* Firefox */
}
.tg-text::-webkit-scrollbar{  /* Chrome/Safari */
  width:0; height:0;
}

.tg-fade{
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,1) 10px);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,1) 10px);
}

/* منوی سنجاق: از پایین به بالا پاپ شود */
.clip-pop-enter-from   { opacity: 0; transform: translateY(6px) scale(0.98); transform-origin: bottom right; }
.clip-pop-enter-active { transition: opacity .12s ease, transform .12s ease; }
.clip-pop-leave-active { transition: opacity .10s ease, transform .10s ease; }
.clip-pop-leave-to     { opacity: 0; transform: translateY(6px) scale(0.98); }
</style>
