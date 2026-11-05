<template>
  <section v-if="index.total.value || index.scanning.value" class="info-card">
    <!-- The newest pictures, as a window onto the rest -->
    <div v-if="shelf.length" class="grid grid-cols-5 gap-0.5 p-0.5">
      <MediaThumb
        v-for="(message, i) in shelf"
        :key="message.id"
        :message="message"
        :actions="actions"
        class="rounded-lg"
        @open="i === shelf.length - 1 && more ? emit('open', 'photos') : actions.openMedia(message)"
      >
        <span v-if="i === shelf.length - 1 && more" class="absolute inset-0 grid place-items-center bg-black/55 text-white text-[15px] font-semibold">+{{ more }}</span>
      </MediaThumb>
    </div>

    <button v-for="row in rows" :key="row.kind" type="button" class="info-row" @click="emit('open', row.kind)">
      <span class="info-chip" :style="{ backgroundColor: `${row.color}26`, color: row.color }"><component :is="row.icon" class="w-[18px] h-[18px]" /></span>
      <span class="flex-1 min-w-0 text-[14.5px] text-ink">{{ $t(`info.${row.kind}`, { n: row.count }, row.count) }}</span>
      <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
    </button>

    <div v-if="index.scanning.value" class="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-muted">
      <Loader2 class="w-4 h-4 animate-spin" /><span>{{ $t('info.reading') }}</span>
    </div>
    <div v-else-if="!rows.length" class="px-4 py-3 text-[13px] text-muted">{{ $t('info.nothingShared') }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, FileText, Film, Image as ImageIcon, Link2, Loader2, Mic, Music } from 'lucide-vue-next'
import type { ChatIndex, SharedKind } from '../chat/composables/useChatIndex'
import MediaThumb from './MediaThumb.vue'
import type { InfoActions } from './types'

const SHELF = 5

const props = defineProps<{ index: ChatIndex; actions: InfoActions }>()
const emit = defineEmits<{ (e: 'open', kind: SharedKind): void }>()

const shelf = computed(() => props.index.media.value.slice(0, SHELF))
const more = computed(() => Math.max(0, props.index.media.value.length - SHELF))

const rows = computed(() => {
  const shared = props.index.shared.value
  return [
    { kind: 'photos' as const, icon: ImageIcon, color: '#3b9eff', count: shared.photos.length },
    { kind: 'videos' as const, icon: Film, color: '#a56bff', count: shared.videos.length },
    { kind: 'files' as const, icon: FileText, color: '#f5a524', count: shared.files.length },
    { kind: 'music' as const, icon: Music, color: '#ff6b8a', count: shared.music.length },
    { kind: 'voice' as const, icon: Mic, color: '#11bfae', count: shared.voice.length },
    { kind: 'links' as const, icon: Link2, color: '#22b8e6', count: shared.links.length }
  ].filter(row => row.count > 0)
})
</script>
