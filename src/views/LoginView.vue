<template>
  <div class="min-h-screen flex items-center justify-center bg-[#F2F2F0] p-4" dir="ltr">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-6">
      <h1 class="text-xl font-bold mb-6 text-center text-[#1B3C59]">Sign in to PhiChat</h1>

      <!-- Mode switch (segmented) -->
      <div class="relative rounded-xl bg-[#F2F2F0] p-1 mb-6 flex gap-1">
        <div
          class="absolute inset-y-1 left-1 w-1/2 rounded-lg bg-white shadow transition-transform duration-200"
          :style="{ transform: mode === 'password' ? 'translateX(0)' : 'translateX(100%)' }"
        ></div>
        <button
          class="relative z-10 flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5"
          :class="mode === 'password' ? 'text-[#1B3C59]' : 'text-[#456173]'" @click="mode = 'password'" v-ripple>
          <Lock class="w-4 h-4" /><span>Password</span>
        </button>
        <button
          class="relative z-10 flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5"
          :class="mode === 'sms' ? 'text-[#1B3C59]' : 'text-[#456173]'" @click="mode = 'sms'" v-ripple>
          <MessageSquare class="w-4 h-4" /><span>SMS code</span>
        </button>

      </div>

      <!-- Sliding forms -->
      <transition name="slide-h" mode="out-in">
        <!-- Password mode -->
        <form v-if="mode === 'password'" key="pwd" @submit.prevent="handlePasswordLogin" class="space-y-4">
          <div>
            <label class="block text-sm mb-1 text-[#456173]">Username or phone</label>
            <input v-model.trim="usernameOrPhone" type="text" class="input" placeholder="e.g. ali or +98912…" required />
          </div>
          <div>
            <label class="block text-sm mb-1 text-[#456173]">Password</label>
            <input v-model="password" type="password" class="input" placeholder="••••••" required />
          </div>

          <button :disabled="loading" class="btn-primary w-full inline-flex items-center justify-center gap-2" v-ripple>
            <template v-if="!loading"><LogIn class="w-4 h-4" /><span>Sign in</span></template>
            <template v-else><Loader2 class="w-4 h-4 animate-spin" /><span>Signing in…</span></template>
          </button>

        </form>

        <!-- SMS mode -->
        <form v-else key="sms" @submit.prevent="handleSmsLogin" class="space-y-4">
          <div>
            <label class="block text-sm mb-1 text-[#456173]">Phone number</label>
            <PhoneInput v-model="phoneE164" :defaultCountry="'IR'" />
            <p class="text-xs text-gray-500 mt-1"></p>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                    :disabled="smsSending || cooldown > 0" @click="sendCode" v-ripple>
              <template v-if="cooldown === 0 && !smsSending">
                <Send class="w-4 h-4" /><span>Send code</span>
              </template>
              <template v-else-if="smsSending">
                <Loader2 class="w-4 h-4 animate-spin" /><span>Sending…</span>
              </template>
              <template v-else>
                <Clock class="w-4 h-4" /><span>Resend in {{ cooldown }}s</span>
              </template>
            </button>

            <input
              v-model.trim="smsCode"
              inputmode="numeric"
              maxlength="8"
              class="input flex-1"
              placeholder="6-digit code"
              required
            />
          </div>

          <button :disabled="loading" class="btn-primary w-full inline-flex items-center justify-center gap-2" v-ripple>
            <template v-if="!loading"><LogIn class="w-4 h-4" /><span>Sign in with SMS</span></template>
            <template v-else><Loader2 class="w-4 h-4 animate-spin" /><span>Signing in…</span></template>
          </button>

        </form>
      </transition>

      <p v-if="error" class="text-red-600 text-sm mt-4 text-center inline-flex items-center justify-center gap-1.5">
        <AlertCircle class="w-4 h-4" /> <span>{{ error }}</span>
      </p>


      <div class="text-center mt-6">
        <RouterLink to="/register" class="text-[#11BFAE] hover:underline">Create a new account</RouterLink>
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
import { API, loginWithSms, requestSmsCode, storeTokenFromAuthResponse } from "../services/api";
import PhoneInput from "../components/PhoneInput.vue";
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

// Ripple directive (local)
const vRipple = {
  mounted(el: HTMLElement) {
    el.style.position ||= "relative";
    el.style.overflow ||= "hidden";
    el.addEventListener("click", (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.1;
      const span = document.createElement("span");
      span.className = "ripple-ink";
      span.style.width = span.style.height = `${size}px`;
      span.style.left = `${e.clientX - rect.left - size / 2}px`;
      span.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(span);
      span.addEventListener("animationend", () => span.remove());
    });
  }
};

async function handlePasswordLogin() {
  error.value = null;
  loading.value = true;
  try {
    const { data } = await API.post("/auth/login", {
      username: usernameOrPhone.value, // backend accepts username OR phone
      password: password.value
    });
    storeTokenFromAuthResponse(data);
    router.push('/chat').then(() => {
      setTimeout(() => window.dispatchEvent(new Event('phichat:reinit')), 0)
    })
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "Login failed";
  } finally {
    loading.value = false;
  }
}

async function sendCode() {
  if (!phoneE164.value) {
    error.value = "Invalid phone number.";
    return;
  }
  error.value = null;
  smsSending.value = true;
  try {
    await requestSmsCode({ phoneNumber: phoneE164.value as string });
    startCooldown(60);
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "Failed to send code";
  } finally {
    smsSending.value = false;
  }
}

async function handleSmsLogin() {
  if (!phoneE164.value) {
    error.value = "Invalid phone number.";
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
    router.push('/chat').then(() => {
      setTimeout(() => window.dispatchEvent(new Event('phichat:reinit')), 0)
    })
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "SMS login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
@reference "tailwindcss";

/* Inputs and buttons with your palette */
.input {
  @apply border rounded-lg px-3 py-2 w-full outline-none bg-white
         focus:ring-2 focus:ring-[#11BFAE]/60 focus:border-[#11BFAE];
}
.btn-primary {
  @apply bg-[#11BFAE] text-white rounded-lg px-4 py-2 hover:bg-[#10B2A3] disabled:opacity-60;
}
.btn-secondary {
  @apply bg-[#456173] text-white rounded-lg px-4 py-2 hover:bg-[#3F5867] disabled:opacity-60;
}

/* Slide between modes */
.slide-h-enter-from { opacity: 0; transform: translateX(12px); }
.slide-h-leave-to   { opacity: 0; transform: translateX(-12px); }
.slide-h-enter-active,
.slide-h-leave-active { transition: all .18s ease; }

/* Ripple (global selector so dynamic span is styled even in scoped SFC) */
:global(.ripple-ink) {
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity: .15;
  transform: scale(0);
  pointer-events: none;
  animation: ripple .5s ease-out forwards;
}
@keyframes ripple {
  to { transform: scale(4); opacity: 0; }
}
</style>
