<template>
  <div class="space-y-5">
    <p v-if="permission === 'unsupported'" class="text-sm text-muted">{{ $t('settings.notificationsUnsupported') }}</p>

    <template v-else>
      <SettingToggle
        :model-value="prefs.notifications && permission === 'granted'"
        :label="$t('settings.notifications')"
        :description="$t('settings.notificationsHint')"
        @update:model-value="setEnabled"
      />

      <p v-if="permission === 'denied'" class="flex items-start gap-2 rounded-xl bg-danger/10 text-danger text-sm p-3">
        <BellOff class="w-4 h-4 shrink-0 mt-0.5" />
        <span>{{ $t('settings.notificationsBlocked') }}</span>
      </p>

      <div class="space-y-5" :class="enabled ? '' : 'opacity-50 pointer-events-none'" :aria-disabled="!enabled">
        <SettingToggle
          v-model="prefs.notificationSound"
          :label="$t('settings.notificationSound')"
        />
        <SettingToggle
          v-model="prefs.notificationPreview"
          :label="$t('settings.notificationPreview')"
          :description="$t('settings.notificationPreviewHint')"
        />

        <button type="button" class="btn-outline gap-1.5 text-sm" @click="sendTest">
          <BellRing class="w-4 h-4" />
          <span>{{ $t('settings.testNotification') }}</span>
        </button>
      </div>

      <p class="flex items-start gap-2 text-xs text-muted">
        <Lock class="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{{ pushSupported ? $t('settings.pushPrivacyHint') : $t('settings.pushUnsupported') }}</span>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BellOff, BellRing, Lock } from 'lucide-vue-next'
import { usePreferencesStore } from '../../stores/preferences'
import {
  notificationPermission,
  playNotificationSound,
  requestNotificationPermission,
  showMessageNotification
} from '../../services/notifications'
import { pushSupported } from '../../services/push'
import { t } from '../../i18n'
import SettingToggle from './SettingToggle.vue'

const { prefs } = usePreferencesStore()
const permission = ref(notificationPermission())

const enabled = computed(() => prefs.notifications && permission.value === 'granted')

/** Turning notifications on asks the browser for permission (it must happen on a click). */
async function setEnabled(value: boolean) {
  if (!value) {
    prefs.notifications = false
    return
  }
  permission.value = await requestNotificationPermission()
  prefs.notifications = permission.value === 'granted'
}

async function sendTest() {
  if (prefs.notificationSound) playNotificationSound()
  await showMessageNotification({
    title: 'PhiChat',
    body: t('settings.testNotificationBody'),
    tag: 'phichat-test',
    url: '/chat'
  })
}
</script>
