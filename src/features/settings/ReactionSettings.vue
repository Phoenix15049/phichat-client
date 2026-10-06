<template>
  <div class="space-y-6">
    <!-- Quick bar -->
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-ink">{{ $t('settings.quickReactions') }}</h3>
      <p class="text-xs text-muted">{{ $t('settings.quickReactionsHint', { max: MAX_QUICK_REACTIONS }) }}</p>
      <div class="flex justify-center py-2">
        <div class="inline-flex items-center gap-0.5 rounded-full bg-surface px-1 py-0.5 shadow ring-1 ring-line">
          <span v-for="emoji in prefs.quickReactions" :key="emoji" class="w-8 h-8 grid place-items-center text-[19px] emoji-font">{{ emoji }}</span>
          <span class="w-7 h-7 grid place-items-center text-muted"><ChevronDown class="w-4 h-4" /></span>
        </div>
      </div>
    </section>

    <!-- All reactions -->
    <section class="space-y-2 border-t border-line pt-5">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-medium text-ink">
          {{ $t('settings.reactionList') }}
          <span class="text-xs text-muted tabular-nums">({{ prefs.reactions.length }}/{{ MAX_REACTIONS }})</span>
        </h3>
        <button type="button" class="text-sm text-accent hover:underline" @click="editing = !editing; adding = false">
          {{ editing ? $t('common.done') : $t('settings.editReactions') }}
        </button>
      </div>
      <p class="text-xs text-muted">{{ editing ? $t('settings.removeReactionsHint') : $t('settings.reactionListHint') }}</p>

      <div class="grid grid-cols-8 gap-1 max-w-[22rem]">
        <button
          v-for="emoji in prefs.reactions"
          :key="emoji"
          type="button"
          class="cell emoji-font"
          :class="[
            !editing && isQuick(emoji) ? 'ring-2 ring-accent bg-accent-soft' : '',
            editing ? 'cell-removable' : ''
          ]"
          :aria-pressed="!editing ? isQuick(emoji) : undefined"
          :aria-label="editing ? $t('settings.removeReaction', { emoji }) : emoji"
          @click="editing ? remove(emoji) : toggleQuick(emoji)"
        >
          {{ emoji }}
          <span v-if="!editing && isQuick(emoji)" class="badge">{{ prefs.quickReactions.indexOf(emoji) + 1 }}</span>
          <span v-if="editing" class="remove"><X class="w-2.5 h-2.5" :stroke-width="3" /></span>
        </button>

        <button
          v-if="prefs.reactions.length < MAX_REACTIONS"
          type="button"
          class="cell text-muted border border-dashed border-line"
          :aria-label="$t('settings.addReaction')"
          @click="adding = !adding"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <p v-if="notice" class="text-xs text-danger">{{ notice }}</p>

      <div v-if="adding" class="pt-2 flex justify-center">
        <EmojiPicker autofocus @select="add" />
      </div>
    </section>

    <div class="border-t border-line pt-4">
      <button type="button" class="btn-outline gap-1.5 text-sm" @click="reset">
        <RotateCcw class="w-4 h-4" />
        <span>{{ $t('settings.resetReactions') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, Plus, RotateCcw, X } from 'lucide-vue-next'
import EmojiPicker from '../emoji/EmojiPicker.vue'
import { usePreferencesStore } from '../../stores/preferences'
import {
  DEFAULT_QUICK_REACTIONS,
  DEFAULT_REACTIONS,
  MAX_QUICK_REACTIONS,
  MAX_REACTIONS,
  MIN_QUICK_REACTIONS
} from '../emoji/reactions'
import { t } from '../../i18n'

const { prefs } = usePreferencesStore()

const editing = ref(false)
const adding = ref(false)
const notice = ref<string | null>(null)

const isQuick = (emoji: string) => prefs.quickReactions.includes(emoji)

function flash(message: string) {
  notice.value = message
  setTimeout(() => { if (notice.value === message) notice.value = null }, 2500)
}

function toggleQuick(emoji: string) {
  if (isQuick(emoji)) {
    if (prefs.quickReactions.length <= MIN_QUICK_REACTIONS) return flash(t('settings.quickReactionsMin'))
    prefs.quickReactions = prefs.quickReactions.filter(r => r !== emoji)
    return
  }
  if (prefs.quickReactions.length >= MAX_QUICK_REACTIONS) return flash(t('settings.quickReactionsMax', { max: MAX_QUICK_REACTIONS }))
  prefs.quickReactions = [...prefs.quickReactions, emoji]
}

function remove(emoji: string) {
  if (prefs.reactions.length <= 1) return
  prefs.reactions = prefs.reactions.filter(r => r !== emoji)
  const quick = prefs.quickReactions.filter(r => r !== emoji)
  // The quick bar is never empty: fall back to the first reaction of the list.
  prefs.quickReactions = quick.length ? quick : prefs.reactions.slice(0, 1)
}

function add(emoji: string) {
  adding.value = false
  if (prefs.reactions.includes(emoji)) return flash(t('settings.reactionExists'))
  if (prefs.reactions.length >= MAX_REACTIONS) return
  prefs.reactions = [...prefs.reactions, emoji]
}

function reset() {
  prefs.reactions = [...DEFAULT_REACTIONS]
  prefs.quickReactions = [...DEFAULT_QUICK_REACTIONS]
  editing.value = false
  adding.value = false
}
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.cell {
  @apply relative aspect-square grid place-items-center rounded-xl text-[22px] leading-none hover:bg-surface-2 transition;
}
.cell-removable {
  @apply animate-none hover:bg-danger/10;
}
.badge {
  @apply absolute -top-1 -end-1 min-w-4 h-4 px-0.5 rounded-full bg-accent text-white text-[10px] font-semibold grid place-items-center leading-none;
}
.remove {
  @apply absolute -top-1 -end-1 w-4 h-4 rounded-full bg-danger text-white grid place-items-center;
}
</style>
