<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2 text-ink font-medium">
      <Palette class="w-4 h-4 text-accent" />
      <span>{{ $t('settings.appearance') }}</span>
    </div>

    <!-- Theme -->
    <div class="space-y-2">
      <div class="text-sm text-muted">{{ $t('settings.theme') }}</div>
      <div class="grid grid-cols-3 gap-2" role="radiogroup">
        <button
          v-for="option in themes"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="prefs.theme === option.value"
          class="flex flex-col items-center gap-1.5 rounded-xl py-3 text-sm ring-1 transition"
          :class="prefs.theme === option.value ? 'ring-2 ring-accent bg-accent-soft text-ink' : 'ring-line bg-surface text-muted hover:text-ink'"
          @click="prefs.theme = option.value"
        >
          <component :is="option.icon" class="w-5 h-5" />
          {{ $t(`settings.themes.${option.value}`) }}
        </button>
      </div>
    </div>

    <!-- Text size -->
    <div class="space-y-2">
      <div class="text-sm text-muted">{{ $t('settings.textSize') }}</div>
      <div class="flex items-center gap-2" role="radiogroup">
        <button
          v-for="size in sizes"
          :key="size"
          type="button"
          role="radio"
          :aria-checked="prefs.textSize === size"
          class="flex-1 rounded-xl py-2 text-sm ring-1 transition"
          :class="prefs.textSize === size ? 'ring-2 ring-accent bg-accent-soft text-ink' : 'ring-line bg-surface text-muted hover:text-ink'"
          @click="prefs.textSize = size"
        >
          {{ $t(`settings.sizes.${size}`) }}
        </button>
      </div>

      <!-- Live preview -->
      <div class="rounded-2xl bg-canvas p-3 space-y-1.5">
        <div class="flex justify-start">
          <div class="preview-bubble bg-bubble-in text-bubble-in-ink rounded-es-md">{{ $t('settings.previewIncoming') }}</div>
        </div>
        <div class="flex justify-end">
          <div class="preview-bubble bg-bubble-out text-bubble-out-ink rounded-ee-md">{{ $t('settings.previewOutgoing') }}</div>
        </div>
      </div>
    </div>

    <!-- Send with Enter -->
    <label class="flex items-center justify-between gap-4 cursor-pointer">
      <span>
        <span class="block text-sm text-ink">{{ $t('settings.sendWithEnter') }}</span>
        <span class="block text-xs text-muted">{{ prefs.sendWithEnter ? $t('settings.sendWithEnterOn') : $t('settings.sendWithEnterOff') }}</span>
      </span>
      <input v-model="prefs.sendWithEnter" type="checkbox" class="peer sr-only" />
      <span class="switch shrink-0" :class="prefs.sendWithEnter ? 'switch-on' : ''"><span class="switch-knob"></span></span>
    </label>
  </section>
</template>

<script setup lang="ts">
import { Monitor, Moon, Palette, Sun } from 'lucide-vue-next'
import { usePreferencesStore, type TextSize, type ThemePreference } from '../../stores/preferences'

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

.preview-bubble {
  @apply max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm;
  font-size: var(--chat-font-size);
}

.switch {
  @apply relative w-9 h-5 rounded-full bg-line transition-colors;
}
.switch-on {
  @apply bg-accent;
}
.switch-knob {
  @apply absolute top-0.5 start-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform;
}
.switch-on .switch-knob {
  transform: translateX(16px);
}
:global([dir="rtl"] .switch-on .switch-knob) {
  transform: translateX(-16px);
}
</style>
