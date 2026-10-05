<template>
  <!-- A quick check on a known device shows nothing, so the card does not flash on every load. -->
  <div v-if="view !== 'checking' || slow" class="fixed inset-0 z-[70] overflow-y-auto bg-[#F2F2F0]">
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-6">
        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-[#11BFAE]/10 text-[#11BFAE]">
          <ShieldCheck class="w-6 h-6" />
        </div>

        <!-- Checking -->
        <div v-if="view === 'checking'" class="flex flex-col items-center gap-3 py-4 text-[#456173]">
          <Loader2 class="w-6 h-6 animate-spin" />
          <span class="text-sm">{{ $t('e2ee.checking') }}</span>
        </div>

        <!-- Could not check -->
        <div v-else-if="view === 'error'" class="space-y-4 text-center">
          <h1 class="text-lg font-bold text-[#1B3C59]">{{ $t('e2ee.title') }}</h1>
          <p class="text-sm text-[#456173]">{{ $t('e2ee.checkFailed') }}</p>
          <button type="button" class="btn-primary w-full" @click="retry">{{ $t('e2ee.retry') }}</button>
        </div>

        <!-- First setup / new key after a lost passphrase -->
        <form v-else-if="view === 'setup' || view === 'reset'" class="space-y-4" @submit.prevent="submitNewKey">
          <h1 class="text-lg font-bold text-center text-[#1B3C59]">
            {{ view === 'setup' ? $t('e2ee.setupTitle') : $t('e2ee.resetTitle') }}
          </h1>

          <p class="text-sm leading-6 text-[#456173]">
            {{ view === 'setup' ? $t('e2ee.setupIntro') : $t('e2ee.resetIntro') }}
          </p>

          <div v-if="view === 'reset'" class="flex gap-2 rounded-lg bg-red-50 text-red-800 text-[13px] leading-6 p-3">
            <TriangleAlert class="w-4 h-4 mt-1 shrink-0" />
            <span>{{ $t('e2ee.resetWarning') }}</span>
          </div>

          <div>
            <label class="block text-sm mb-1 text-[#456173]" for="e2ee-new">{{ $t('e2ee.passphrase') }}</label>
            <PassphraseInput id="e2ee-new" v-model="passphrase" autocomplete="new-password" />
            <p class="text-xs mt-1" :class="strengthClass">{{ strengthLabel }}</p>
          </div>

          <div>
            <label class="block text-sm mb-1 text-[#456173]" for="e2ee-confirm">{{ $t('e2ee.confirmPassphrase') }}</label>
            <PassphraseInput id="e2ee-confirm" v-model="confirmation" autocomplete="new-password" />
          </div>

          <label class="flex items-start gap-2 text-[13px] leading-6 text-[#1B3C59]">
            <input v-model="understood" type="checkbox" class="mt-1.5 accent-[#11BFAE]" />
            <span>{{ view === 'setup' ? $t('e2ee.understandSetup') : $t('e2ee.understandReset') }}</span>
          </label>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

          <button type="submit" class="btn-primary w-full gap-2" :disabled="busy || !canSubmitNew">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ view === 'setup' ? $t('e2ee.enable') : $t('e2ee.createNewKey') }}</span>
          </button>

          <button v-if="view === 'reset'" type="button" class="btn-ghost w-full" :disabled="busy" @click="switchTo('restore')">
            {{ $t('common.back') }}
          </button>
        </form>

        <!-- Restore on this device -->
        <form v-else class="space-y-4" @submit.prevent="submitRestore">
          <h1 class="text-lg font-bold text-center text-[#1B3C59]">{{ $t('e2ee.restoreTitle') }}</h1>
          <p class="text-sm leading-6 text-[#456173]">{{ $t('e2ee.restoreIntro') }}</p>

          <div>
            <label class="block text-sm mb-1 text-[#456173]" for="e2ee-restore">{{ $t('e2ee.passphrase') }}</label>
            <PassphraseInput id="e2ee-restore" v-model="passphrase" autocomplete="current-password" autofocus />
          </div>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

          <button type="submit" class="btn-primary w-full gap-2" :disabled="busy || !passphrase">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ $t('e2ee.restore') }}</span>
          </button>

          <button type="button" class="btn-ghost w-full text-sm" :disabled="busy" @click="switchTo('reset')">
            {{ $t('e2ee.forgotPassphrase') }}
          </button>
        </form>

        <div class="mt-5 pt-4 border-t border-black/10 flex items-center justify-between text-sm">
          <LanguageSwitch />
          <button type="button" class="btn-ghost gap-1" :disabled="busy" @click="signOut">
            <LogOut class="w-4 h-4 rtl:-scale-x-100" />
            <span>{{ $t('settings.logout') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2, LogOut, ShieldCheck, TriangleAlert } from 'lucide-vue-next'
import LanguageSwitch from '../../components/LanguageSwitch.vue'
import PassphraseInput from './PassphraseInput.vue'
import { MIN_PASSPHRASE_LENGTH, useE2eeStore } from '../../stores/e2ee'
import { getErrorMessage, logout } from '../../services/api'
import { useSessionStore } from '../../stores/session'
import { passphraseStrength } from './passphrase'

type View = 'checking' | 'error' | 'setup' | 'restore' | 'reset'

const e2ee = useE2eeStore()
const session = useSessionStore()
const router = useRouter()
const { t } = useI18n()

const resetRequested = ref(false)
const passphrase = ref('')
const confirmation = ref('')
const understood = ref(false)
const busy = ref(false)
const error = ref('')

const slow = ref(false)
const slowTimer = window.setTimeout(() => { slow.value = true }, 400)
onBeforeUnmount(() => window.clearTimeout(slowTimer))

const view = computed<View>(() => {
  switch (e2ee.status) {
    case 'setup': return 'setup'
    case 'restore': return resetRequested.value ? 'reset' : 'restore'
    case 'error': return 'error'
    default: return 'checking'
  }
})

watch(view, () => {
  passphrase.value = ''
  confirmation.value = ''
  understood.value = false
  error.value = ''
})

function switchTo(next: 'restore' | 'reset') {
  resetRequested.value = next === 'reset'
}

const strength = computed(() => passphraseStrength(passphrase.value))

const strengthLabel = computed(() => {
  if (!passphrase.value) return t('e2ee.passphraseHint', { min: MIN_PASSPHRASE_LENGTH })
  return t(`e2ee.strength.${strength.value}`)
})

const strengthClass = computed(() => ({
  'text-[#456173]': !passphrase.value,
  'text-red-600': !!passphrase.value && strength.value === 'tooShort',
  'text-amber-600': strength.value === 'weak',
  'text-emerald-600': strength.value === 'good' || strength.value === 'strong'
}))

const canSubmitNew = computed(() =>
  strength.value !== 'tooShort' &&
  passphrase.value === confirmation.value &&
  understood.value
)

function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code === 'wrong_passphrase') return t('e2ee.wrongPassphrase')
  return getErrorMessage(err)
}

async function submitNewKey() {
  if (!canSubmitNew.value || busy.value) return
  if (passphrase.value !== confirmation.value) {
    error.value = t('e2ee.mismatch')
    return
  }

  busy.value = true
  error.value = ''
  try {
    if (view.value === 'setup') await e2ee.setup(passphrase.value)
    else await e2ee.reset(passphrase.value)
    resetRequested.value = false
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    busy.value = false
  }
}

async function submitRestore() {
  if (!passphrase.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await e2ee.restore(passphrase.value)
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    busy.value = false
  }
}

function retry() {
  void e2ee.init(session.userId)
}

async function signOut() {
  await logout()
  e2ee.resetState()
  session.reset()
  await router.replace('/login')
}
</script>
