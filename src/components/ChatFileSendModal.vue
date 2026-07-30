<template>
  <ModalSheet
    :open="props.open"
    @close="emit('close')"
  >
    <div
      class="p-5 w-[480px] max-w-full"
      dir="ltr"
    >
      <div
        class="flex items-center justify-between mb-3"
      >
        <h3
          class="text-lg font-bold text-[#1B3C59]"
        >
          Send as files
        </h3>

        <button
          v-ripple
          type="button"
          class="btn-ghost"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Files list -->
      <div
        class="space-y-2 max-h-64 overflow-y-auto"
      >
        <div
          v-for="(file, index) in props.files"
          :key="
            `${file.name}-${file.size}-${file.lastModified}-${index}`
          "
          class="flex items-center gap-3 p-3 rounded-lg bg-white ring-1 ring-[#456173]/15 hover:ring-[#11BFAE]/30 transition"
        >
          <div
            class="w-10 h-10 shrink-0 rounded bg-[#1B3C59] grid place-items-center text-white"
          >
            <FileIcon class="w-5 h-5" />
          </div>

          <div class="flex-1 min-w-0">
            <div
              class="font-medium text-[#1B3C59] truncate"
            >
              {{ file.name }}
            </div>

            <div
              class="text-xs text-[#456173]"
            >
              {{
                props.humanFileSize(
                  file.size
                )
              }}
            </div>
          </div>

          <button
            v-ripple
            type="button"
            class="btn-danger"
            @click="
              emit(
                'remove-file',
                index
              )
            "
          >
            Remove
          </button>
        </div>
      </div>

      <!-- Caption -->
      <label
        class="block text-sm text-[#456173] mt-3 mb-1"
      >
        Caption (optional, applies to all)
      </label>

      <textarea
        :value="props.caption"
        rows="3"
        dir="auto"
        class="input w-full min-h-[84px] text-start auto-dir"
        placeholder="Write a caption…"
        @input="onCaptionInput"
      ></textarea>

      <!-- Actions -->
      <div
        class="mt-4 flex items-center justify-between"
      >
        <button
          v-ripple
          type="button"
          class="btn-ghost"
          @click="emit('close')"
        >
          Cancel
        </button>

        <div
          class="flex items-center gap-2"
        >
          <button
            v-ripple
            type="button"
            class="btn-outline"
            @click="emit('add-more')"
          >
            Add more
          </button>

          <button
            v-ripple
            type="button"
            class="btn-primary"
            :disabled="
              props.sending ||
              props.files.length === 0
            "
            @click="emit('send')"
          >
            {{
              props.sending
                ? 'Sending…'
                : `Send (${props.files.length})`
            }}
          </button>
        </div>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import type {
  ObjectDirective
} from 'vue'

import {
  File as FileIcon,
  X
} from 'lucide-vue-next'

import ModalSheet from './ModalSheet.vue'

const props = defineProps<{
  open: boolean
  files: File[]
  caption: string
  sending: boolean

  humanFileSize:
    (bytes: number) => string
}>()

const emit = defineEmits<{
  (
    event: 'update:caption',
    value: string
  ): void

  (
    event: 'remove-file',
    index: number
  ): void

  (event: 'close'): void
  (event: 'add-more'): void
  (event: 'send'): void
}>()

function onCaptionInput(
  event: Event
) {
  const textarea =
    event.target as HTMLTextAreaElement

  emit(
    'update:caption',
    textarea.value
  )
}

const rippleHandlers =
  new WeakMap<
    HTMLElement,
    (event: MouseEvent) => void
  >()

const vRipple:
  ObjectDirective<HTMLElement> = {
    mounted(element) {
      element.style.position ||=
        'relative'

      element.style.overflow ||=
        'hidden'

      const handler = (
        event: MouseEvent
      ) => {
        const rect =
          element.getBoundingClientRect()

        const size =
          Math.max(
            rect.width,
            rect.height
          ) * 1.1

        const ripple =
          document.createElement('span')

        ripple.className =
          'ripple-ink'

        ripple.style.width =
          `${size}px`

        ripple.style.height =
          `${size}px`

        ripple.style.left =
          `${
            event.clientX -
            rect.left -
            size / 2
          }px`

        ripple.style.top =
          `${
            event.clientY -
            rect.top -
            size / 2
          }px`

        element.appendChild(ripple)

        ripple.addEventListener(
          'animationend',
          () => ripple.remove(),
          {
            once: true
          }
        )
      }

      rippleHandlers.set(
        element,
        handler
      )

      element.addEventListener(
        'click',
        handler
      )
    },

    beforeUnmount(element) {
      const handler =
        rippleHandlers.get(element)

      if (handler) {
        element.removeEventListener(
          'click',
          handler
        )
      }

      rippleHandlers.delete(element)
    }
  }
</script>