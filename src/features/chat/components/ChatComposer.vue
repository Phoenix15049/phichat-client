<template>
  <div v-if="props.visible" class="composer shrink-0 bg-surface border-t border-line">
    <div class="w-full px-2 sm:px-4">
      <!-- Reply / edit banner -->
      <Transition name="banner">
        <div v-if="props.replying || props.editing" class="flex items-center gap-3 pt-2 ps-2">
          <component :is="props.editing ? Pencil : Reply" class="w-5 h-5 shrink-0 text-accent rtl:-scale-x-100" />
          <div class="flex-1 min-w-0 border-s-2 border-accent ps-2">
            <div class="text-[13px] font-semibold text-accent">
              {{ props.editing ? $t('chat.editing') : $t('chat.reply') }}
            </div>
            <div v-if="props.replying && !props.editing" class="text-[13px] text-muted truncate">
              <bdi>{{ props.replyPreview }}</bdi>
            </div>
          </div>
          <button
            type="button"
            class="icon-btn w-8 h-8"
            :aria-label="$t('common.cancel')"
            @click="props.editing ? emit('cancel-edit') : emit('cancel-reply')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </Transition>

      <!-- Link preview for the first link in the text -->
      <Transition name="banner">
        <div v-if="(props.linkPreview || props.linkPreviewLoading) && !recorder.recording.value" class="flex items-center gap-3 pt-2 ps-2">
          <Link2 class="w-5 h-5 shrink-0 text-accent" />
          <div class="flex-1 min-w-0 border-s-2 border-accent ps-2">
            <template v-if="props.linkPreview">
              <div class="text-[13px] font-semibold text-accent truncate">{{ props.linkPreview.siteName || props.linkPreview.title }}</div>
              <div class="text-[13px] text-muted truncate" dir="auto">{{ props.linkPreview.title || props.linkPreview.description }}</div>
            </template>
            <div v-else class="text-[13px] text-muted py-1">{{ $t('chat.loadingPreview') }}</div>
          </div>
          <img v-if="props.linkPreview?.image" :src="props.linkPreview.image" alt="" class="w-10 h-10 rounded-md object-cover shrink-0" />
          <button type="button" class="icon-btn w-8 h-8" :aria-label="$t('chat.removePreview')" @click="emit('dismiss-preview')">
            <X class="w-4 h-4" />
          </button>
        </div>
      </Transition>

      <form class="flex items-end gap-1 py-2" @submit.prevent="submit">
        <!-- Emoji -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="icon-btn"
            :class="emojiOpen ? 'text-accent' : ''"
            :title="$t('emoji.title')"
            :aria-label="$t('emoji.title')"
            @mousedown.prevent
            @click="emojiOpen = !emojiOpen"
          >
            <Smile class="w-6 h-6" />
          </button>

          <Transition name="pop">
            <div v-if="emojiOpen" class="absolute bottom-full start-0 mb-2 z-50">
              <EmojiPicker @select="insertEmoji" />
            </div>
          </Transition>
        </div>

        <!-- Recording a voice message -->
        <div v-if="recorder.recording.value" class="flex-1 min-w-0 h-11 flex items-center gap-3 rounded-[22px] bg-surface-2 px-4">
          <span class="w-2.5 h-2.5 rounded-full bg-danger animate-pulse"></span>
          <span class="text-sm tabular-nums text-ink" dir="ltr">{{ formatSeconds(recorder.elapsed.value) }}</span>
          <span class="flex-1 text-sm text-muted truncate">{{ $t('chat.recording') }}</span>
          <button type="button" class="text-sm font-medium text-danger hover:underline" @click="recorder.cancel()">
            {{ $t('common.cancel') }}
          </button>
        </div>

        <!-- Message -->
        <div v-show="!recorder.recording.value" class="flex-1 min-w-0 rounded-[22px] bg-surface-2 ring-accent/40 focus-within:ring-2 transition">
          <textarea
            :ref="bindMessageInput"
            :value="props.modelValue"
            rows="1"
            dir="auto"
            :placeholder="$t('chat.writeMessage')"
            class="tg-text tg-fade block w-full bg-transparent border-0 px-4 py-2.5 leading-6 resize-none overflow-y-auto box-border will-change-[height] outline-none text-ink placeholder:text-muted"
            style="transition: height .14s ease; font-size: var(--chat-font-size);"
            @keydown.enter="onEnter"
            @input="handleInput"
            @blur="emit('composer-blur')"
          />
        </div>

        <!-- Attach -->
        <div v-show="!recorder.recording.value" class="relative shrink-0">
          <button
            type="button"
            class="icon-btn"
            :class="attachOpen ? 'text-accent' : ''"
            :title="$t('chat.attach')"
            :aria-label="$t('chat.attach')"
            @click="attachOpen = !attachOpen"
          >
            <Paperclip class="w-6 h-6" />
          </button>

          <Transition name="pop">
            <div
              v-if="attachOpen"
              class="absolute bottom-full end-0 mb-2 w-52 py-1 rounded-2xl bg-surface shadow-xl ring-1 ring-line z-50"
            >
              <button type="button" class="attach-item" @click="pickAttachment('open-media')">
                <ImageIcon class="w-5 h-5 text-accent" /> {{ $t('chat.attachMedia') }}
              </button>
              <button type="button" class="attach-item" @click="pickAttachment('open-file')">
                <FileIcon class="w-5 h-5 text-accent" /> {{ $t('chat.attachFile') }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Voice: record when there is nothing to send, then send the recording -->
        <button
          v-if="recorder.recording.value"
          type="button"
          class="shrink-0 w-11 h-11 rounded-full grid place-items-center bg-accent text-white shadow-sm transition hover:bg-accent-strong active:scale-95"
          :aria-label="$t('chat.sendVoice')"
          @click="finishRecording"
        >
          <SendHorizontal class="w-5 h-5 rtl:-scale-x-100" />
        </button>
        <button
          v-else-if="showMic"
          type="button"
          class="shrink-0 w-11 h-11 rounded-full grid place-items-center text-muted hover:text-accent hover:bg-surface-2 transition active:scale-95"
          :title="$t('chat.recordVoice')"
          :aria-label="$t('chat.recordVoice')"
          @click="startRecording"
        >
          <Mic class="w-6 h-6" />
        </button>

        <!-- Send -->
        <button
          v-else
          type="submit"
          class="shrink-0 w-11 h-11 rounded-full grid place-items-center bg-accent text-white shadow-sm transition hover:bg-accent-strong active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!props.canSend"
          :aria-label="$t('chat.send')"
          @mousedown.prevent
        >
          <Check v-if="props.editing" class="w-5 h-5" />
          <span v-else :key="sendPulse" class="grid place-items-center" :class="sendPulse ? 'send-fly' : ''">
            <SendHorizontal class="w-5 h-5 rtl:-scale-x-100" />
          </span>
        </button>

        <!-- Hidden inputs -->
        <input :ref="bindFileInput" type="file" class="hidden" multiple @change="emit('files-chosen', $event)" />
        <input
          :ref="bindMediaInput"
          type="file"
          class="hidden"
          multiple
          accept="image/*,video/*"
          @change="emit('media-chosen', $event)"
        />
      </form>
    </div>

    <!-- Click outside closes the popovers. -->
    <div v-if="emojiOpen || attachOpen" class="fixed inset-0 z-40" @click="emojiOpen = attachOpen = false"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import {
  Check, File as FileIcon, Image as ImageIcon, Link2, Mic, Paperclip, Pencil, Reply, SendHorizontal, Smile, X
} from 'lucide-vue-next'
import type { LinkPreviewMeta } from '../../../services/e2ee/messageCodec'
import { useVoiceRecorder, type RecordedVoice } from '../composables/useVoiceRecorder'
import EmojiPicker from '../../emoji/EmojiPicker.vue'
import { usePreferencesStore } from '../../../stores/preferences'

const props = defineProps<{
  modelValue: string
  visible: boolean
  canSend: boolean
  replying: boolean
  replyPreview: string
  editing: boolean
  /** Whether a voice message could be sent now (the peer can receive messages). */
  canRecord: boolean
  linkPreview: LinkPreviewMeta | null
  linkPreviewLoading: boolean
  setMessageInput: (element: HTMLTextAreaElement | null) => void
  setFileInput: (element: HTMLInputElement | null) => void
  setMediaInput: (element: HTMLInputElement | null) => void
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'send'): void
  (event: 'composer-blur'): void
  (event: 'open-file'): void
  (event: 'open-media'): void
  (event: 'cancel-reply'): void
  (event: 'cancel-edit'): void
  (event: 'composer-input', value: Event): void
  (event: 'files-chosen', value: Event): void
  (event: 'media-chosen', value: Event): void
  (event: 'dismiss-preview'): void
  (event: 'send-voice', value: RecordedVoice): void
  (event: 'voice-error', value: unknown): void
}>()

const recorder = useVoiceRecorder()

/** The mic replaces the send button while there is nothing to send (like Telegram). */
const showMic = computed(() => recorder.supported && props.canRecord && !props.editing && !props.modelValue.trim())

async function startRecording() {
  try {
    await recorder.start()
  } catch (error) {
    emit('voice-error', error)
  }
}

async function finishRecording() {
  const recorded = await recorder.stop()
  if (recorded) emit('send-voice', recorded)
}

function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const preferences = usePreferencesStore()
const emojiOpen = ref(false)
const attachOpen = ref(false)
let textarea: HTMLTextAreaElement | null = null

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  emit('composer-input', event)
}

/** Enter sends (Shift+Enter: new line), or Ctrl/Cmd+Enter when "send with Enter" is off. */
function onEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  const modifier = event.ctrlKey || event.metaKey
  const send = preferences.prefs.sendWithEnter ? !event.shiftKey && !modifier : modifier
  if (send) {
    event.preventDefault()
    submit()
  }
}

/** Bumped on every send: restarts the send icon's little flight. */
const sendPulse = ref(0)

function submit() {
  if (props.canSend && !props.editing) sendPulse.value++
  emit('send')
  // Keep typing in place (a click on the send button must not take the focus away).
  textarea?.focus({ preventScroll: true })
}

/** Inserts at the caret and keeps typing where the emoji went. */
async function insertEmoji(emoji: string) {
  const element = textarea
  if (!element) return

  const start = element.selectionStart ?? element.value.length
  const end = element.selectionEnd ?? start
  element.value = element.value.slice(0, start) + emoji + element.value.slice(end)
  element.dispatchEvent(new Event('input', { bubbles: true }))

  await nextTick()
  const caret = start + emoji.length
  element.focus()
  element.setSelectionRange(caret, caret)
}

function pickAttachment(kind: 'open-file' | 'open-media') {
  attachOpen.value = false
  if (kind === 'open-file') emit('open-file')
  else emit('open-media')
}

function bindMessageInput(element: Element | ComponentPublicInstance | null) {
  textarea = element instanceof HTMLTextAreaElement ? element : null
  props.setMessageInput(textarea)
}

function bindFileInput(element: Element | ComponentPublicInstance | null) {
  props.setFileInput(element instanceof HTMLInputElement ? element : null)
}

function bindMediaInput(element: Element | ComponentPublicInstance | null) {
  props.setMediaInput(element instanceof HTMLInputElement ? element : null)
}
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.composer textarea {
  resize: none !important;
  overflow-y: auto;
}
.composer textarea::-webkit-resizer { display: none; }

.tg-text {
  scrollbar-width: none;
}
.tg-text::-webkit-scrollbar { width: 0; height: 0; }

.tg-fade {
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,1) 8px);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,1) 8px);
}

.attach-item {
  @apply w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-ink hover:bg-surface-2 transition text-start;
}

.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(6px) scale(.98); }
/* The send icon flies off and comes back; transform-only, so typing never waits for it. */
.send-fly { animation: send-fly .32s cubic-bezier(.3, .7, .3, 1); }
@keyframes send-fly {
  0% { transform: translateX(0) scale(1); opacity: 1; }
  45% { transform: translateX(10px) scale(.8); opacity: 0; }
  46% { transform: translateX(-8px) scale(.8); opacity: 0; }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}
:global([dir="rtl"]) .send-fly { animation-name: send-fly-rtl; }
@keyframes send-fly-rtl {
  0% { transform: translateX(0) scale(1); opacity: 1; }
  45% { transform: translateX(-10px) scale(.8); opacity: 0; }
  46% { transform: translateX(8px) scale(.8); opacity: 0; }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .send-fly { animation: none; }
}

.pop-enter-active, .pop-leave-active { transition: opacity .12s ease, transform .12s ease; }

.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(4px); }
.banner-enter-active, .banner-leave-active { transition: opacity .12s ease, transform .12s ease; }
</style>
