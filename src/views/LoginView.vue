<template>
  <div class="min-h-screen flex items-center justify-center bg-canvas p-4">
    <div class="w-full max-w-md bg-surface rounded-2xl shadow-xl ring-1 ring-line p-6">
      <div class="flex justify-end mb-2"><LanguageSwitch /></div>
      <h1 class="text-xl font-bold mb-6 text-center text-ink">{{ $t('auth.signInTitle') }}</h1>

      <!-- Mode switch (segmented) -->
      <div class="relative rounded-xl bg-canvas p-1 mb-6 flex gap-1">
        <div
          class="absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-lg bg-surface shadow transition-transform duration-200"
          :style="{ transform: mode === 'password' ? 'translateX(0)' : (isRtl() ? 'translateX(-100%)' : 'translateX(100%)') }"
        ></div>
        <button
          class="relative z-10 flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5"
          :class="mode === 'password' ? 'text-ink' : 'text-muted'" @click="mode = 'password'" v-ripple>
          <Lock class="w-4 h-4" /><span>{{ $t('auth.modePassword') }}</span>
        </button>
        <button
          class="relative z-10 flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5"
          :class="mode === 'sms' ? 'text-ink' : 'text-muted'" @click="mode = 'sms'" v-ripple>
          <MessageSquare class="w-4 h-4" /><span>{{ $t('auth.modeSms') }}</span>
        </button>

      </div>

      <!-- Sliding forms -->
      <transition name="slide-h" mode="out-in">
        <!-- Password mode -->
        <form v-if="mode === 'password'" key="pwd" @submit.prevent="handlePasswordLogin" class="space-y-4">
          <div>
            <label class="block text-sm mb-1 text-muted">{{ $t('auth.usernameOrPhone') }}</label>
            <input v-model.trim="usernameOrPhone" type="text" class="input" dir="ltr" :placeholder="$t('auth.usernameOrPhonePlaceholder')" required />
          </div>
          <div>
            <label class="block text-sm mb-1 text-muted">{{ $t('auth.password') }}</label>
            <input v-model="password" type="password" class="input" dir="ltr" placeholder="••••••" required />
          </div>

          <button :disabled="loading" class="btn-primary w-full inline-flex items-center justify-center gap-2" v-ripple>
            <template v-if="!loading"><LogIn class="w-4 h-4" /><span>{{ $t('auth.signIn') }}</span></template>
            <template v-else><Loader2 class="w-4 h-4 animate-spin" /><span>{{ $t('auth.signingIn') }}</span></template>
          </button>

        </form>

        <!-- SMS mode -->
        <form v-else key="sms" @submit.prevent="handleSmsLogin" class="space-y-4">
          <div>
            <label class="block text-sm mb-1 text-muted">{{ $t('auth.phoneNumber') }}</label>
            <PhoneInput v-model="phoneE164" :defaultCountry="'IR'" />
            <p class="text-xs text-muted mt-1"></p>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                    :disabled="smsSending || cooldown > 0" @click="sendCode" v-ripple>
              <template v-if="cooldown === 0 && !smsSending">
                <Send class="w-4 h-4" /><span>{{ $t('auth.sendCode') }}</span>
              </template>
              <template v-else-if="smsSending">
                <Loader2 class="w-4 h-4 animate-spin" /><span>{{ $t('common.sending') }}</span>
              </template>
              <template v-else>
                <Clock class="w-4 h-4" /><span>{{ $t('auth.resendIn', { seconds: cooldown }) }}</span>
              </template>
            </button>

            <input
              v-model.trim="smsCode"
              inputmode="numeric"
              maxlength="6"
              class="input flex-1"
              :placeholder="$t('auth.codePlaceholder')"
              required
            />
          </div>

          <button :disabled="loading" class="btn-primary w-full inline-flex items-center justify-center gap-2" v-ripple>
            <template v-if="!loading"><LogIn class="w-4 h-4" /><span>{{ $t('auth.signInWithSms') }}</span></template>
            <template v-else><Loader2 class="w-4 h-4 animate-spin" /><span>{{ $t('auth.signingIn') }}</span></template>
          </button>

        </form>
      </transition>

      <p v-if="error" class="text-danger text-sm mt-4 text-center inline-flex items-center justify-center gap-1.5">
        <AlertCircle class="w-4 h-4" /> <span>{{ error }}</span>
      </p>


      <div class="text-center mt-6">
        <RouterLink to="/register" class="text-accent hover:underline">{{ $t('auth.createAccount') }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Lock, MessageSquare, LogIn, Loader2, Send, Clock, AlertCircle
} from 'lucide-vue-next'

import { ref, onBeforeUnmount,onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  getErrorCode,
  getErrorMessage,
  loginWithPassword,
  loginWithSms,
  requestSmsCode,
  storeTokenFromAuthResponse
} from "../services/api";
import PhoneInput from "../components/PhoneInput.vue";
import LanguageSwitch from "../components/LanguageSwitch.vue";
import { isRtl, t } from "../i18n";
import { getToken, isJwtExpired } from '../services/auth'
// ui state
const mode = ref<"password" | "sms">("password");
const loading = ref(false);
const error = ref<string | null>(null);

// password mode
const usernameOrPhone = ref("");
const password = ref("");

// sms mode
const phoneE164 = ref<string | null>(null);
const smsCode = ref("");
const smsSending = ref(false);
const cooldown = ref(0);
let timer: number | null = null;

const router = useRouter();

function startCooldown(sec = 60) {
  cooldown.value = sec;
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }, 1000) as unknown as number;
}

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});


onMounted(() => {
  const t = getToken()
  if (t && !isJwtExpired(t)) {
    router.replace('/chat')
  }
})


async function handlePasswordLogin() {
  error.value = null;
  loading.value = true;
  try {
    // The backend accepts a username or a phone number here.
    const data = await loginWithPassword(usernameOrPhone.value, password.value);
    storeTokenFromAuthResponse(data);
    await router.push('/chat');
  } catch (e: any) {
    error.value = getErrorMessage(e, t("auth.loginFailed"));
  } finally {
    loading.value = false;
  }
}

function retryAfterSeconds(e: any): number | null {
  const value = Number(e?.response?.headers?.['retry-after']);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

async function sendCode() {
  if (!phoneE164.value) {
    error.value = t("auth.invalidPhone");
    return;
  }
  error.value = null;
  smsSending.value = true;
  try {
    await requestSmsCode({ phoneNumber: phoneE164.value as string });
    startCooldown(60);
  } catch (e: any) {
    error.value = getErrorMessage(e, t("auth.sendCodeFailed"));
    const wait = retryAfterSeconds(e);
    if (wait && wait <= 3600) startCooldown(wait);
  } finally {
    smsSending.value = false;
  }
}

async function handleSmsLogin() {
  if (!phoneE164.value) {
    error.value = t("auth.invalidPhone");
    return;
  }
  error.value = null;
  loading.value = true;
  try {
    const data = await loginWithSms({
      phoneNumber: phoneE164.value as string,
      code: smsCode.value
    });
    storeTokenFromAuthResponse(data);
    await router.push('/chat');
  } catch (e: any) {
    error.value = getErrorCode(e) === 'no_account'
      ? t("auth.noAccountForPhone")
      : getErrorMessage(e, t("auth.smsLoginFailed"));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
@reference "../assets/tailwind.css";

/* Inputs and buttons with your palette */
.input {
  @apply border rounded-lg px-3 py-2 w-full outline-none bg-surface
         focus:ring-2 focus:ring-accent/60 focus:border-accent;
}
.btn-primary {
  @apply bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-strong disabled:opacity-60;
}

/* Slide between modes */
.slide-h-enter-from { opacity: 0; transform: translateX(12px); }
.slide-h-leave-to   { opacity: 0; transform: translateX(-12px); }
.slide-h-enter-active,
.slide-h-leave-active { transition: all .18s ease; }

</style>
