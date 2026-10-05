<template>
  <ModalSheet
    :open="props.open"
    @close="emit('close')"
  >
    <div
      class="p-5 w-[480px] max-w-full"
    >
      <div
        class="flex items-center justify-between mb-3"
      >
        <h3
          class="text-lg font-bold text-ink"
        >
          {{ $t('chat.sendAsFiles') }}
        </h3>

        <button
          v-ripple
          type="button"
          class="btn-ghost"
          :aria-label="$t('common.close')"
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
          class="flex items-center gap-3 p-3 rounded-lg bg-surface ring-1 ring-muted/15 hover:ring-accent/30 transition"
        >
          <div
            class="w-10 h-10 shrink-0 rounded-lg bg-accent-soft grid place-items-center text-accent-strong"
          >
            <FileIcon class="w-5 h-5" />
          </div>

          <div class="flex-1 min-w-0">
            <div
              class="font-medium text-ink truncate"
            >
              {{ file.name }}
            </div>

            <div
              class="text-xs text-muted"
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
            {{ $t('common.remove') }}
          </button>
        </div>
      </div>

      <!-- Caption -->
      <label
        class="block text-sm text-muted mt-3 mb-1"
      >
        {{ $t('chat.captionAll') }}
      </label>

      <textarea
        :value="props.caption"
        rows="3"
        dir="auto"
        class="input w-full min-h-[84px] text-start auto-dir"
        :placeholder="$t('chat.writeCaption')"
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
          {{ $t('common.cancel') }}
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
            {{ $t('chat.addMore') }}
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
                ? $t('common.sending')
                : $t('chat.sendCount', { count: props.files.length })
            }}
          </button>
        </div>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">

import {
  File as FileIcon,
  X
} from 'lucide-vue-next'

import ModalSheet from '../../../components/ModalSheet.vue'

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

</script>