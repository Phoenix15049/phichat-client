<template>
  <div class="space-y-6">
    <section class="flex items-center justify-between gap-4">
      <div>
        <h3 class="text-sm font-medium text-ink">{{ $t('settings.languageHint') }}</h3>
        <p class="text-xs text-muted mt-0.5">{{ $t('settings.languageDescription') }}</p>
      </div>
      <LanguageSwitch />
    </section>

    <SettingToggle
      v-model="prefs.sendWithEnter"
      :label="$t('settings.sendWithEnter')"
      :description="prefs.sendWithEnter ? $t('settings.sendWithEnterOn') : $t('settings.sendWithEnterOff')"
    />
  </div>
</template>

<script setup lang="ts">
import LanguageSwitch from '../../components/LanguageSwitch.vue'
import { usePreferencesStore } from '../../stores/preferences'
import SettingToggle from './SettingToggle.vue'

const { prefs } = usePreferencesStore()
</script>
