<template>
  <div
    class="emoji-picker w-[344px] max-w-[calc(100vw-16px)] h-[400px] max-h-[60vh] flex flex-col rounded-2xl bg-surface shadow-2xl ring-1 ring-line overflow-hidden"
    @click.stop
    @mousedown.prevent
  >
    <!-- Search -->
    <div class="p-2 pb-1">
      <div class="relative">
        <Search class="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted pointer-events-none" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          class="w-full h-9 rounded-full bg-surface-2 ps-9 pe-3 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 ring-accent/50"
          :placeholder="$t('emoji.search')"
          @mousedown.stop
        />
      </div>
    </div>

    <!-- Category tabs -->
    <div v-if="!query" class="flex items-center gap-0.5 px-1.5 pb-1 border-b border-line">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex-1 h-8 grid place-items-center rounded-lg transition"
        :class="activeTab === tab.key ? 'text-accent bg-accent-soft' : 'text-muted hover:text-ink hover:bg-surface-2'"
        :title="$t(`emoji.groups.${tab.key}`)"
        :aria-label="$t(`emoji.groups.${tab.key}`)"
        @click="scrollToGroup(tab.key)"
      >
        <component :is="tab.icon" class="w-[18px] h-[18px]" />
      </button>

      <!-- Skin tone -->
      <div class="relative">
        <button
          type="button"
          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-surface-2 text-lg emoji-font"
          :title="$t('emoji.skinTone')"
          :aria-label="$t('emoji.skinTone')"
          @click="tonesOpen = !tonesOpen"
        >{{ TONE_SAMPLES[skinTone] }}</button>
        <div
          v-if="tonesOpen"
          class="absolute top-full end-0 mt-1 z-10 flex gap-0.5 p-1 rounded-xl bg-surface shadow-lg ring-1 ring-line"
        >
          <button
            v-for="(sample, tone) in TONE_SAMPLES"
            :key="tone"
            type="button"
            class="w-8 h-8 grid place-items-center rounded-lg text-lg emoji-font hover:bg-surface-2"
            :class="tone === skinTone ? 'bg-accent-soft' : ''"
            @click="chooseTone(tone)"
          >{{ sample }}</button>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div ref="scroller" class="flex-1 overflow-y-auto px-1.5 pb-2" @scroll.passive="onScroll">
      <div v-if="!groups.length" class="h-full grid place-items-center text-muted">
        <Loader2 class="w-6 h-6 animate-spin" />
      </div>

      <template v-else-if="query">
        <div class="section-title">{{ $t('emoji.results') }}</div>
        <div v-if="results.length" class="grid grid-cols-8">
          <button
            v-for="item in results"
            :key="item.unicode"
            type="button"
            class="emoji-cell emoji-font"
            :title="item.label"
            @click="pick(withTone(item))"
          >{{ withTone(item) }}</button>
        </div>
        <div v-else class="py-10 text-center text-sm text-muted">{{ $t('emoji.noResults') }}</div>
      </template>

      <template v-else>
        <section v-if="recentEmojis.length" data-group="recent">
          <div class="section-title">{{ $t('emoji.groups.recent') }}</div>
          <div class="grid grid-cols-8">
            <button
              v-for="emoji in recentEmojis"
              :key="'r' + emoji"
              type="button"
              class="emoji-cell emoji-font"
              @click="pick(emoji)"
            >{{ emoji }}</button>
          </div>
        </section>

        <section v-for="group in groups" :key="group.key" :data-group="group.key">
          <div class="section-title">{{ $t(`emoji.groups.${group.key}`) }}</div>
          <div class="grid grid-cols-8">
            <button
              v-for="item in group.items"
              :key="item.unicode"
              type="button"
              class="emoji-cell emoji-font"
              :title="item.label"
              @click="pick(withTone(item))"
            >{{ withTone(item) }}</button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, type Component } from 'vue'
import {
  Apple, Car, Clock, Flag, Heart, Lightbulb, Loader2, PawPrint, PartyPopper, Search, Smile, Users
} from 'lucide-vue-next'
import {
  loadEmojiGroups, recentEmojis, rememberEmoji, setSkinTone, skinTone, withTone,
  type EmojiGroup, type EmojiGroupKey
} from './emojiData'

const props = withDefaults(defineProps<{ autofocus?: boolean }>(), { autofocus: false })
const emit = defineEmits<{ (e: 'select', emoji: string): void }>()

const TONE_SAMPLES = ['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿']

const ICONS: Record<EmojiGroupKey | 'recent', Component> = {
  recent: Clock, smileys: Smile, people: Users, animals: PawPrint, food: Apple,
  travel: Car, activities: PartyPopper, objects: Lightbulb, symbols: Heart, flags: Flag
}

const groups = shallowRef<EmojiGroup[]>([])
const query = ref('')
const activeTab = ref<EmojiGroupKey | 'recent'>('smileys')
const tonesOpen = ref(false)
const scroller = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const tabs = computed(() => {
  const keys: Array<EmojiGroupKey | 'recent'> = recentEmojis.value.length ? ['recent'] : []
  keys.push(...groups.value.map(group => group.key))
  return keys.map(key => ({ key, icon: ICONS[key] }))
})

const results = computed(() => {
  const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const found = []
  for (const group of groups.value) {
    for (const item of group.items) {
      if (terms.every(term => item.keywords.includes(term))) found.push(item)
      if (found.length >= 160) return found
    }
  }
  return found
})

onMounted(async () => {
  groups.value = await loadEmojiGroups()
  activeTab.value = recentEmojis.value.length ? 'recent' : 'smileys'
  if (props.autofocus) searchInput.value?.focus()
})

function pick(emoji: string) {
  rememberEmoji(emoji)
  emit('select', emoji)
}

function chooseTone(tone: number) {
  setSkinTone(tone)
  tonesOpen.value = false
}

async function scrollToGroup(key: EmojiGroupKey | 'recent') {
  await nextTick()
  const section = scroller.value?.querySelector<HTMLElement>(`[data-group="${key}"]`)
  if (section && scroller.value) {
    scroller.value.scrollTo({ top: section.offsetTop - scroller.value.offsetTop, behavior: 'smooth' })
    activeTab.value = key
  }
}

/** Highlights the tab of the section at the top of the grid. */
function onScroll() {
  const container = scroller.value
  if (!container) return
  const top = container.scrollTop + container.offsetTop + 8
  let current: string | null = null
  for (const section of container.querySelectorAll<HTMLElement>('[data-group]')) {
    if (section.offsetTop <= top) current = section.dataset.group ?? null
    else break
  }
  if (current) activeTab.value = current as EmojiGroupKey | 'recent'
}
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.section-title {
  @apply sticky top-0 z-[1] bg-surface/95 backdrop-blur px-1.5 pt-2 pb-1 text-[12px] font-semibold text-muted;
}
.emoji-cell {
  @apply aspect-square grid place-items-center rounded-lg text-[26px] leading-none hover:bg-surface-2 active:scale-90 transition;
}
</style>
