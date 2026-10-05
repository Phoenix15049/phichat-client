<template>
  <div class="inline-flex rounded-lg bg-canvas p-0.5 text-xs" role="group" :aria-label="$t('common.language')">
    <button
      v-for="option in options"
      :key="option.locale"
      type="button"
      class="rounded-md px-2.5 py-1 transition"
      :class="locale === option.locale ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
      :aria-pressed="locale === option.locale"
      :lang="option.locale"
      @click="setLocale(option.locale)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, type AppLocale } from '../i18n'

const { locale } = useI18n()

// Each language is labelled in itself, so it is recognisable whatever the current UI language.
const options: { locale: AppLocale; label: string }[] = [
  { locale: 'fa', label: 'فارسی' },
  { locale: 'en', label: 'English' }
]
</script>
