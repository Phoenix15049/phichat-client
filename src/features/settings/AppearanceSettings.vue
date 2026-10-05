<template>
  <div class="space-y-6">
    <!-- Live preview of the chat with the current choices -->
    <div class="rounded-2xl bg-canvas p-4 space-y-1.5 ring-1 ring-line">
      <div class="flex justify-start">
        <div class="preview-bubble bg-bubble-in text-bubble-in-ink border-line" style="border-end-start-radius: var(--bubble-tail-radius)">
          {{ $t('settings.previewIncoming') }}
          <span class="preview-time">10:41</span>
        </div>
      </div>
      <div class="flex justify-end">
        <div class="preview-bubble bg-bubble-out text-bubble-out-ink border-accent/35 rounded-ee-none">
          {{ $t('settings.previewOutgoing') }}
          <span class="preview-time">10:42 <CheckCheck class="inline w-3.5 h-3.5 text-accent" /></span>
        </div>
      </div>
    </div>

    <!-- Theme -->
    <section class="space-y-2">
      <h3 class="setting-title">{{ $t('settings.theme') }}</h3>
      <div class="grid grid-cols-3 gap-2" role="radiogroup">
        <button
          v-for="option in themes"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="prefs.theme === option.value"
          class="choice flex-col gap-1.5 py-3"
          :class="prefs.theme === option.value ? 'choice-on' : ''"
          @click="prefs.theme = option.value"
        >
          <component :is="option.icon" class="w-5 h-5" />
          {{ $t(`settings.themes.${option.value}`) }}
        </button>
      </div>
    </section>

    <!-- Text size -->
    <section class="space-y-2">
      <h3 class="setting-title">{{ $t('settings.textSize') }}</h3>
      <div class="grid grid-cols-3 gap-2" role="radiogroup">
        <button
          v-for="size in sizes"
          :key="size"
          type="button"
          role="radio"
          :aria-checked="prefs.textSize === size"
          class="choice py-2"
          :class="prefs.textSize === size ? 'choice-on' : ''"
          @click="prefs.textSize = size"
        >
          {{ $t(`settings.sizes.${size}`) }}
        </button>
      </div>
    </section>

    <!-- Bubble corners -->
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="setting-title">{{ $t('settings.bubbleRadius') }}</h3>
        <span class="text-xs text-muted tabular-nums">{{ prefs.bubbleRadius }}px</span>
      </div>
      <input
        v-model.number="prefs.bubbleRadius"
        type="range"
        :min="BUBBLE_RADIUS_MIN"
        :max="BUBBLE_RADIUS_MAX"
        step="1"
        class="w-full accent-[var(--color-accent)]"
        :aria-label="$t('settings.bubbleRadius')"
      />
      <div class="flex justify-between text-[11px] text-muted">
        <span>{{ $t('settings.radiusSharp') }}</span>
        <span>{{ $t('settings.radiusRound') }}</span>
      </div>
    </section>

    <SettingToggle
      v-model="prefs.bubbleBorder"
      :label="$t('settings.bubbleBorder')"
      :description="$t('settings.bubbleBorderHint')"
    />
  </div>
</template>

<script setup lang="ts">
import { CheckCheck, Monitor, Moon, Sun } from 'lucide-vue-next'
import {
  BUBBLE_RADIUS_MAX, BUBBLE_RADIUS_MIN, usePreferencesStore, type TextSize, type ThemePreference
} from '../../stores/preferences'
import SettingToggle from './SettingToggle.vue'

const { prefs } = usePreferencesStore()

const themes: Array<{ value: ThemePreference; icon: typeof Sun }> = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon }
]
const sizes: TextSize[] = ['small', 'medium', 'large']
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.setting-title {
  @apply text-sm font-medium text-ink;
}
.choice {
  @apply flex items-center justify-center rounded-xl text-sm ring-1 ring-line bg-surface text-muted hover:text-ink transition;
}
.choice-on {
  @apply ring-2 ring-accent bg-accent-soft text-ink;
}
.preview-bubble {
  @apply max-w-[80%] px-3 pt-1.5 pb-1 shadow-sm border-solid;
  font-size: var(--chat-font-size);
  border-radius: var(--bubble-radius);
  border-width: var(--bubble-border);
}
.preview-bubble.rounded-ee-none {
  border-end-end-radius: var(--bubble-tail-radius);
}
.preview-time {
  @apply ms-2 text-[11px] text-meta inline-flex items-center gap-0.5 align-bottom;
}
</style>
