<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        role="tab"
        class="tab"
        :class="tab === kind ? 'tab-on' : ''"
        :aria-selected="tab === kind"
        @click="emit('update:kind', tab)"
      >{{ $t(`info.tab.${tab}`) }}</button>
    </div>

    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <template v-for="section in sections" :key="section.label">
        <div class="month">{{ section.label }}</div>

        <!-- Photos and videos -->
        <div v-if="kind === 'photos' || kind === 'videos'" class="grid grid-cols-3 gap-0.5">
          <MediaThumb
            v-for="entry in section.entries"
            :key="entry.key"
            :message="entry.message"
            :actions="actions"
            @open="actions.openMedia(entry.message)"
          />
        </div>

        <!-- Links -->
        <ul v-else-if="kind === 'links'">
          <li v-for="entry in section.entries" :key="entry.key" class="line group">
            <a :href="entry.link!.url" target="_blank" rel="noopener noreferrer nofollow" class="flex-1 min-w-0 flex items-center gap-3">
              <span class="w-11 h-11 shrink-0 rounded-[35%] grid place-items-center text-white font-semibold uppercase" :style="{ backgroundColor: colorFromString(entry.link!.host) }">{{ entry.link!.host[0] }}</span>
              <span class="min-w-0">
                <span class="block text-[14px] font-medium text-ink truncate" dir="auto">{{ entry.link!.title }}</span>
                <span class="block text-[12.5px] text-accent truncate" dir="ltr">{{ entry.link!.url }}</span>
              </span>
            </a>
            <button type="button" class="goto" :title="$t('player.goToMessage')" :aria-label="$t('player.goToMessage')" @click="actions.goTo(entry.message)">
              <MessageSquareText class="w-4 h-4" />
            </button>
          </li>
        </ul>

        <!-- Files, music and voice -->
        <ul v-else>
          <li v-for="entry in section.entries" :key="entry.key" class="line group">
            <button
              type="button"
              class="w-11 h-11 shrink-0 rounded-[35%] grid place-items-center overflow-hidden bg-accent text-white hover:bg-accent-strong transition"
              :aria-label="kind === 'files' ? $t('chat.download') : $t('chat.play')"
              @click="onPrimary(entry.message)"
            >
              <img v-if="kind === 'music' && entry.message.file?.audio?.cover" :src="entry.message.file.audio.cover" alt="" class="w-full h-full object-cover" />
              <template v-else-if="kind === 'files'">
                <Loader2 v-if="actions.downloading[actions.fileKey(entry.message)]" class="w-5 h-5 animate-spin" />
                <Check v-else-if="actions.downloaded[actions.fileKey(entry.message)]" class="w-5 h-5" />
                <FileDown v-else class="w-5 h-5" />
              </template>
              <Pause v-else-if="isPlaying(entry.message)" class="w-5 h-5" fill="currentColor" />
              <Play v-else class="w-5 h-5 translate-x-[1px]" fill="currentColor" />
            </button>
            <button type="button" class="flex-1 min-w-0 text-start" @click="onPrimary(entry.message)">
              <span class="block text-[14px] font-medium text-ink truncate" dir="auto">{{ titleOf(entry.message) }}</span>
              <span class="block text-[12.5px] text-muted truncate">{{ detailOf(entry.message) }}</span>
            </button>
            <button type="button" class="goto" :title="$t('player.goToMessage')" :aria-label="$t('player.goToMessage')" @click="actions.goTo(entry.message)">
              <MessageSquareText class="w-4 h-4" />
            </button>
          </li>
        </ul>
      </template>

      <div ref="sentinel" class="h-1"></div>

      <div v-if="index.scanning.value" class="flex items-center justify-center gap-2 py-4 text-[12.5px] text-muted">
        <Loader2 class="w-4 h-4 animate-spin" /><span>{{ $t('info.reading') }}</span>
      </div>
      <div v-else-if="!allEntries.length" class="py-14 text-center text-sm text-muted">{{ $t('info.emptyTab') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, FileDown, Loader2, MessageSquareText, Pause, Play } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { formatClock } from '../audio/format'
import { useAudioPlayer } from '../audio/useAudioPlayer'
import type { ChatIndex, SharedKind, SharedLink } from '../chat/composables/useChatIndex'
import type { UiMessage } from '../../types/chat'
import { colorFromString } from '../../utils/avatar'
import { toDateSafe } from '../../utils/time'
import MediaThumb from './MediaThumb.vue'
import type { InfoActions } from './types'

/** Rows added to the page at a time; a chat can hold thousands. */
const STEP = 60

const props = defineProps<{ index: ChatIndex; actions: InfoActions; kind: SharedKind }>()
const emit = defineEmits<{ (e: 'update:kind', kind: SharedKind): void }>()

const { locale } = useI18n()
const player = useAudioPlayer()

const tabs: SharedKind[] = ['photos', 'videos', 'files', 'music', 'voice', 'links']

type Entry = { key: string; message: UiMessage; link?: SharedLink }

const allEntries = computed<Entry[]>(() => {
  const shared = props.index.shared.value
  if (props.kind === 'links') return shared.links.map((link, i) => ({ key: `${link.message.id}-${i}`, message: link.message, link }))
  return shared[props.kind].map(message => ({ key: message.id!, message }))
})

const limit = ref(STEP)

const monthFormat = computed(() => new Intl.DateTimeFormat(locale.value === 'en' ? 'en' : 'fa', { month: 'long', year: 'numeric' }))

/** Grouped by month, newest first. */
const sections = computed(() => {
  const result: Array<{ label: string; entries: Entry[] }> = []
  for (const entry of allEntries.value.slice(0, limit.value)) {
    const date = toDateSafe(entry.message.sentAt)
    const label = date ? monthFormat.value.format(date) : ''
    const last = result[result.length - 1]
    if (last?.label === label) last.entries.push(entry)
    else result.push({ label, entries: [entry] })
  }
  return result
})

const scroller = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && limit.value < allEntries.value.length) limit.value += STEP
  }, { root: scroller.value, rootMargin: '400px' })
  if (sentinel.value) observer.observe(sentinel.value)
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => props.kind, () => {
  limit.value = STEP
  if (scroller.value) scroller.value.scrollTop = 0
})

const isPlaying = (message: UiMessage) => player.state.playing && player.state.current?.key === message.id

function onPrimary(message: UiMessage) {
  if (props.kind === 'files') void props.actions.download(message)
  else if (player.state.current?.key === message.id) void player.toggle()
  else props.actions.playAudio(message, allEntries.value.map(entry => entry.message))
}

function titleOf(message: UiMessage) {
  const file = message.file
  if (props.kind === 'voice') return formatDate(message)
  return file?.audio?.title || file?.name || ''
}

function formatDate(message: UiMessage) {
  const date = toDateSafe(message.sentAt)
  return date ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en' : 'fa', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : ''
}

function detailOf(message: UiMessage) {
  const file = message.file
  if (props.kind === 'voice') return file?.voice ? formatClock(file.voice.duration) : ''
  if (props.kind === 'music' && file?.audio?.performer) return file.audio.performer
  return [props.actions.humanFileSize(file?.size ?? 0), formatDate(message)].filter(Boolean).join(' · ')
}
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.tabs {
  @apply shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-line;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }
.tab {
  @apply shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink transition;
}
.tab-on {
  @apply bg-accent text-white hover:bg-accent hover:text-white;
}
.month {
  @apply sticky top-0 z-[1] px-4 py-1.5 text-[12.5px] font-medium text-muted;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
}
.line {
  @apply flex items-center gap-3 px-4 py-2 hover:bg-surface-2 transition;
}
.goto {
  @apply shrink-0 w-8 h-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-ink/10 transition sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100;
}
</style>
