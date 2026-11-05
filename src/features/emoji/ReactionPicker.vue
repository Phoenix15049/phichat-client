<template>
  <div class="reaction-grid glass-panel" role="listbox" :aria-label="$t('emoji.more')">
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
  @apply grid grid-cols-8 gap-0.5 p-2 rounded-2xl;
}
/* Measured from the message text size, like the rest of the reactions. */
.reaction-cell {
  @apply grid place-items-center rounded-lg leading-none hover:bg-ink/10 hover:scale-110 active:scale-95 transition;
  width: calc(var(--chat-font-size) * 2.1);
  height: calc(var(--chat-font-size) * 2.1);
  font-size: calc(var(--chat-font-size) * 1.25);
}
</style>
