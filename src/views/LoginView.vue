<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow p-6">
      <h1 class="text-xl font-bold mb-4 text-center">ورود به PhiChat</h1>

      <!-- Mode switch -->
      <div class="flex mb-6 rounded-lg bg-gray-100 p-1">
        <button
          class="flex-1 py-2 rounded-md text-sm font-medium"
          :class="mode === 'password' ? 'bg-white shadow' : 'text-gray-600'"
          @click="mode = 'password'"
        >
          ورود با رمز
        </button>
        <button
          class="flex-1 py-2 rounded-md text-sm font-medium"
          :class="mode === 'sms' ? 'bg-white shadow' : 'text-gray-600'"
          @click="mode = 'sms'"
        >
          ورود با پیامک
        </button>
      </div>

      <!-- Password mode -->
      <form v-if="mode === 'password'" @submit.prevent="handlePasswordLogin" class="space-y-4">
        <div>
          <label class="block text-sm mb-1">یوزرنیم یا شماره موبایل</label>
          <input v-model.trim="usernameOrPhone" type="text" class="w-full input" placeholder="ali یا +98912..." required />
        </div>
        <div>
          <label class="block text-sm mb-1">رمز عبور</label>
          <input v-model="password" type="password" class="w-full input" required />
        </div>

        <button :disabled="loading" class="btn-primary w-full">
          <span v-if="!loading">ورود</span>
          <span v-else>در حال ورود…</span>
        </button>
      </form>

      <!-- SMS mode -->
      <form v-else @submit.prevent="handleSmsLogin" class="space-y-4">
        <div>
          <label class="block text-sm mb-1">شماره موبایل (E.164)</label>
          <input v-model.trim="phoneNumber" type="tel" class="w-full input" placeholder="+98912xxxxxxx" required />
          <p class="text-xs text-gray-500 mt-1">فرمت پیشنهادی: +98912…</p>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" class="btn-secondary flex-1" :disabled="smsSending || cooldown > 0" @click="sendCode">
            <span v-if="cooldown === 0 && !smsSending">ارسال کُد</span>
            <span v-else-if="smsSending">در حال ارسال…</span>
            <span v-else>ارسال مجدد در {{ cooldown }} ثانیه</span>
          </button>
          <input
            v-model.trim="smsCode"
            inputmode="numeric"
            maxlength="8"
            class="input flex-1"
            placeholder="کُد ۶ رقمی"
            required
          />
        </div>

        <button :disabled="loading" class="btn-primary w-full">
          <span v-if="!loading">ورود با پیامک</span>
          <span v-else>در حال ورود…</span>
        </button>
      </form>

      <p v-if="error" class="text-red-600 text-sm mt-4 text-center">{{ error }}</p>

      <div class="text-center mt-6">
        <RouterLink to="/register" class="text-indigo-600 hover:underline">ثبت‌نام</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { loginWithSms, requestSmsCode, storeTokenFromAuthResponse } from "../services/api";
import {API} from "../services/api"; // assuming default export is the axios instance or existing helpers

// ui state
const mode = ref<"password" | "sms">("password");
const loading = ref(false);
const error = ref<string | null>(null);

// password mode
const usernameOrPhone = ref("");
const password = ref("");

// sms mode
const phoneNumber = ref("");
const smsCode = ref("");
const smsSending = ref(false);
const cooldown = ref(0);
let timer: number | null = null;

const router = useRouter();

// helpers
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

// actions
async function handlePasswordLogin() {
  error.value = null;
  loading.value = true;
  try {
    // existing login API in your project:
    const { data } = await API.post("/auth/login", {
      username: usernameOrPhone.value, // backend accepts username OR phone
      password: password.value,
    });
    storeTokenFromAuthResponse(data);
    router.push("/chat");
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "خطا در ورود";
  } finally {
    loading.value = false;
  }
}

async function sendCode() {
  if (!phoneNumber.value) return;
  error.value = null;
  smsSending.value = true;
  try {
    await requestSmsCode({ phoneNumber: phoneNumber.value });
    startCooldown(60);
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "ارسال کُد ناموفق بود";
  } finally {
    smsSending.value = false;
  }
}

async function handleSmsLogin() {
  error.value = null;
  loading.value = true;
  try {
    const data = await loginWithSms({
      phoneNumber: phoneNumber.value,
      code: smsCode.value,
    });
    storeTokenFromAuthResponse(data);
    router.push("/chat");
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "ورود با پیامک ناموفق بود";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
@reference "tailwindcss";
/* tiny utilities to match your Tailwind styling */
.input {
  @apply border rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500;
}
.btn-primary {
  @apply bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:opacity-60;
}
.btn-secondary {
  @apply bg-gray-200 text-gray-800 rounded-lg px-4 py-2 hover:bg-gray-300 disabled:opacity-60;
}
</style>
