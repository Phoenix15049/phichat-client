<template>
  <div class="reaction-grid" role="listbox" :aria-label="$t('emoji.more')">
    <button
      v-for="emoji in prefs.reactions"
      :key="emoji"
      type="button"
      role="option"
      class="reaction-cell emoji-font"
      @click="emit('select', emoji)"
    >{{ emoji }}</button>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '../../stores/preferences'

/** The user's reaction list (Settings > Reactions), shown when "more" is opened on a message. */
const emit = defineEmits<{ (e: 'select', emoji: string): void }>()
const { prefs } = usePreferencesStore()
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.reaction-grid {
  @apply grid grid-cols-8 gap-0.5 p-2 rounded-2xl bg-surface shadow-xl ring-1 ring-line;
}
.reaction-cell {
  @apply w-8 h-8 grid place-items-center rounded-lg text-[19px] leading-none hover:bg-surface-2 hover:scale-110 active:scale-95 transition;
}
</style>
