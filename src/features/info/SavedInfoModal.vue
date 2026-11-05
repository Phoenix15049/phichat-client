<template>
  <InfoSheet
    :open="open"
    :name="$t('menu.savedMessages')"
    :status="status"
    :icon="Bookmark"
    :page-key="page"
    :page-title="pageTitle"
    @close="emit('close')"
    @back="page = null"
  >
    <div class="flex gap-2">
      <button type="button" class="info-tile" @click="emit('search')">
        <Search class="w-5 h-5" /><span>{{ $t('info.search') }}</span>
      </button>
      <button type="button" class="info-tile" @click="openShared('photos')">
        <Images class="w-5 h-5" /><span>{{ $t('info.sharedMedia') }}</span>
      </button>
    </div>

    <SharedMediaSection :index="index" :actions="actions" @open="openShared" />

    <section v-if="index.sources.value.length" class="info-card">
      <div class="info-heading">{{ $t('info.savedFrom') }}</div>
      <button v-for="source in shownSources" :key="source.senderId ?? 'notes'" type="button" class="info-row" @click="openSource(source)">
        <span v-if="!source.senderId" class="w-10 h-10 shrink-0 rounded-[35%] grid place-items-center bg-accent text-white"><NotebookPen class="w-5 h-5" /></span>
        <span
          v-else
          class="w-10 h-10 shrink-0 rounded-[35%] overflow-hidden grid place-items-center text-white text-sm font-semibold"
          :style="!avatarOf(source.senderId) ? { backgroundColor: colorFromString(labelOf(source)) } : {}"
        >
          <img v-if="avatarOf(source.senderId)" :src="avatarOf(source.senderId)!" class="w-full h-full object-cover" alt="" />
          <template v-else>{{ initialsOf(labelOf(source)) }}</template>
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[14.5px] font-medium text-ink truncate"><bdi>{{ labelOf(source) }}</bdi></span>
          <span class="block text-[12.5px] text-muted truncate" dir="auto">{{ preview(source.messages[0]) }}</span>
        </span>
        <span class="shrink-0 text-[12.5px] text-muted tabular-nums">{{ source.messages.length }}</span>
      </button>
    </section>

    <template #page>
      <SharedMediaPage v-if="page === 'shared'" v-model:kind="sharedKind" :index="index" :actions="actions" />

      <ul v-else-if="page === 'source' && source" class="flex-1 overflow-y-auto p-2">
        <li v-for="message in source.messages.slice(0, 200)" :key="message.id">
          <button type="button" class="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-surface-2 transition" @click="actions.goTo(message)">
            <span class="flex-1 min-w-0 text-[14px] text-ink truncate" dir="auto">{{ preview(message) }}</span>
            <span class="shrink-0 text-[12px] text-muted">{{ formatDayLabel(message.sentAt) }}</span>
          </button>
        </li>
      </ul>
    </template>
  </InfoSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bookmark, Images, NotebookPen, Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { ChatIndex, SavedSource, SharedKind } from '../chat/composables/useChatIndex'
import { previewText } from '../chat/composables/useConversations'
import type { UiMessage } from '../../types/chat'
import { colorFromString, initialsOf } from '../../utils/avatar'
import { formatDayLabel } from '../../utils/time'
import InfoSheet from './InfoSheet.vue'
import SharedMediaPage from './SharedMediaPage.vue'
import SharedMediaSection from './SharedMediaSection.vue'
import type { InfoActions } from './types'

const MAX_SOURCES = 30

const props = defineProps<{
  open: boolean
  index: ChatIndex
  actions: InfoActions
  /** Display name of someone a message was forwarded from. */
  senderLabel: (userId: string) => string
  senderAvatar: (userId: string) => string | null
}>()

const emit = defineEmits<{ (e: 'close' | 'search'): void }>()

const { t } = useI18n()

const page = ref<'shared' | 'source' | null>(null)
const sharedKind = ref<SharedKind>('photos')
const source = ref<SavedSource | null>(null)

watch(() => props.open, () => { page.value = null })

const status = computed(() => t('info.savedCount', { n: props.index.total.value }, props.index.total.value))
const shownSources = computed(() => props.index.sources.value.slice(0, MAX_SOURCES))
const labelOf = (item: SavedSource) => (item.senderId ? props.senderLabel(item.senderId) : t('info.myNotes'))
const avatarOf = (id: string) => props.senderAvatar(id)
const pageTitle = computed(() => (page.value === 'source' && source.value ? labelOf(source.value) : t('info.sharedMedia')))

const preview = (message: UiMessage) => previewText(message) || t('common.media')

function openShared(kind: SharedKind) {
  sharedKind.value = kind
  page.value = 'shared'
}

function openSource(item: SavedSource) {
  source.value = item
  page.value = 'source'
}
</script>
