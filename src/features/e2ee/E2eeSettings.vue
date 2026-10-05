<template>
  <section class="space-y-3">
    <div class="flex items-center gap-2 text-ink font-medium">
      <ShieldCheck class="w-4 h-4 text-accent" />
      <span>{{ $t('e2ee.title') }}</span>
    </div>

    <p class="text-sm text-muted">{{ $t('e2ee.settingsIntro') }}</p>

    <div v-if="e2ee.identity" class="text-xs text-muted">
      {{ $t('e2ee.yourKey') }}:
      <code dir="ltr" class="ms-1 px-1.5 py-0.5 rounded bg-surface ring-1 ring-line">{{ e2ee.identity.keyId }}</code>
    </div>

    <button
      v-if="!open"
      type="button"
      class="btn-outline inline-flex items-center gap-1.5"
      :disabled="e2ee.status !== 'ready'"
      @click="open = true"
    >
      <KeyRound class="w-4 h-4" />
      <span>{{ $t('e2ee.changePassphrase') }}</span>
    </button>

    <form v-else class="space-y-3 rounded-xl bg-surface ring-1 ring-line p-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm mb-1 text-muted" for="e2ee-current">{{ $t('e2ee.currentPassphrase') }}</label>
        <PassphraseInput id="e2ee-current" v-model="current" autocomplete="current-password" />
      </div>
      <div>
        <label class="block text-sm mb-1 text-muted" for="e2ee-next">{{ $t('e2ee.newPassphrase') }}</label>
        <PassphraseInput id="e2ee-next" v-model="next" autocomplete="new-password" />
        <p class="text-xs mt-1 text-muted">
          {{ next ? $t(`e2ee.strength.${strength}`) : $t('e2ee.passphraseHint', { min: MIN_PASSPHRASE_LENGTH }) }}
        </p>
      </div>
      <div>
        <label class="block text-sm mb-1 text-muted" for="e2ee-repeat">{{ $t('e2ee.confirmPassphrase') }}</label>
        <PassphraseInput id="e2ee-repeat" v-model="repeat" autocomplete="new-password" />
      </div>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <div class="flex items-center gap-2">
        <button type="submit" class="btn-primary gap-2" :disabled="busy || !canSubmit">
          <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
          <span>{{ $t('common.save') }}</span>
        </button>
        <button type="button" class="btn-ghost" :disabled="busy" @click="close">{{ $t('common.cancel') }}</button>
      </div>
    </form>

    <p v-if="done" class="text-sm text-green-600 inline-flex items-center gap-1.5">
      <Check class="w-4 h-4" /> <span>{{ $t('e2ee.passphraseChanged') }}</span>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, KeyRound, Loader2, ShieldCheck } from 'lucide-vue-next'
import PassphraseInput from './PassphraseInput.vue'
import { MIN_PASSPHRASE_LENGTH, useE2eeStore } from '../../stores/e2ee'
import { getErrorMessage } from '../../services/api'
import { passphraseStrength } from './passphrase'
import { useSessionStore } from '../../stores/session'

const e2ee = useE2eeStore()
const session = useSessionStore()
const { t } = useI18n()

// Opened on its own (the /settings route) the key may not have been loaded yet.
onMounted(() => {
  if (e2ee.status === 'idle') {
    session.syncFromToken()
    if (session.userId) void e2ee.init(session.userId)
  }
})

const open = ref(false)
const current = ref('')
const next = ref('')
const repeat = ref('')
const busy = ref(false)
const error = ref('')
const done = ref(false)

const strength = computed(() => passphraseStrength(next.value))
const canSubmit = computed(() => !!current.value && strength.value !== 'tooShort' && next.value === repeat.value)

function close() {
  open.value = false
  current.value = next.value = repeat.value = ''
  error.value = ''
}

async function submit() {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  error.value = ''
  done.value = false
  try {
    await e2ee.changePassphrase(current.value, next.value)
    close()
    done.value = true
  } catch (err) {
    error.value = (err as { code?: string })?.code === 'wrong_passphrase'
      ? t('e2ee.wrongPassphrase')
      : getErrorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>
