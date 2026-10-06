<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2 text-ink font-medium">
      <Eye class="w-4 h-4 text-accent" />
      <span>{{ $t('settings.lastSeenTitle') }}</span>
    </div>

    <div v-if="!settings" class="flex justify-center py-3 text-muted">
      <Loader2 v-if="!loadError" class="w-5 h-5 animate-spin" />
      <span v-else class="text-sm text-danger">{{ loadError }}</span>
    </div>

    <template v-else>
      <div role="radiogroup" :aria-label="$t('settings.lastSeenTitle')" class="space-y-1">
        <button
          v-for="option in LEVELS"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="settings.lastSeen === option"
          class="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-surface-2 transition"
          @click="save({ lastSeen: option })"
        >
          <span
            class="w-5 h-5 shrink-0 rounded-full border-2 grid place-items-center transition"
            :class="settings.lastSeen === option ? 'border-accent' : 'border-line'"
          >
            <span v-if="settings.lastSeen === option" class="w-2.5 h-2.5 rounded-full bg-accent"></span>
          </span>
          <span class="text-sm text-ink">{{ $t(`settings.lastSeen.${option}`) }}</span>
        </button>
      </div>
      <p class="text-xs text-muted">{{ $t('settings.lastSeenHint') }}</p>

      <div class="border-t border-line pt-4">
        <SettingToggle
          :model-value="settings.readReceipts"
          :label="$t('settings.readReceipts')"
          :description="$t('settings.readReceiptsHint')"
          @update:model-value="save({ readReceipts: $event })"
        />
      </div>

      <p v-if="saveError" class="text-sm text-danger">{{ saveError }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Eye, Loader2 } from 'lucide-vue-next'
import {
  getErrorMessage,
  getPrivacySettings,
  updatePrivacySettings,
  type LastSeenVisibility,
  type PrivacySettings
} from '../../services/api'
import SettingToggle from './SettingToggle.vue'

const LEVELS: LastSeenVisibility[] = ['everyone', 'contacts', 'nobody']

const settings = ref<PrivacySettings | null>(null)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)

onMounted(async () => {
  try {
    settings.value = await getPrivacySettings()
  } catch (err) {
    loadError.value = getErrorMessage(err)
  }
})

/** Applies the change at once and rolls it back if the server refuses it. */
async function save(patch: Partial<PrivacySettings>) {
  if (!settings.value) return
  const previous = settings.value
  const next = { ...previous, ...patch }
  if (next.lastSeen === previous.lastSeen && next.readReceipts === previous.readReceipts) return

  settings.value = next
  saveError.value = null
  try {
    await updatePrivacySettings(next)
  } catch (err) {
    if (settings.value === next) settings.value = previous
    saveError.value = getErrorMessage(err)
  }
}
</script>
