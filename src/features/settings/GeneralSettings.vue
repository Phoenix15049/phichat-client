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

    <SettingToggle
      v-model="prefs.linkPreviews"
      :label="$t('settings.linkPreviews')"
      :description="$t('settings.linkPreviewsHint')"
    />

    <section v-if="canInstall || installed" class="flex items-center justify-between gap-4 border-t border-line pt-5">
      <div>
        <h3 class="text-sm font-medium text-ink">{{ $t('settings.installApp') }}</h3>
        <p class="text-xs text-muted mt-0.5">{{ installed ? $t('settings.appInstalled') : $t('settings.installAppHint') }}</p>
      </div>
      <button v-if="canInstall" type="button" class="btn-primary gap-1.5 text-sm shrink-0" @click="promptInstall">
        <Download class="w-4 h-4" />
        <span>{{ $t('settings.install') }}</span>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import LanguageSwitch from '../../components/LanguageSwitch.vue'
import { canInstall, isStandalone, promptInstall } from '../../services/pwa'
import { usePreferencesStore } from '../../stores/preferences'
import SettingToggle from './SettingToggle.vue'

const { prefs } = usePreferencesStore()
const installed = isStandalone()
</script>
