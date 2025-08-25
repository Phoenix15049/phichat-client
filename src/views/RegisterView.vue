<template>
  
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow p-6">
      <h1 class="text-xl font-bold mb-4 text-center">ثبت‌نام در PhiChat</h1>

      <!-- Step 1: Phone & Code -->
        <div v-if="step === 1" class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold">ثبت‌نام - مرحله ۱</div>

          <PhoneInput v-model="phoneE164" :defaultCountry="'IR'" />

          <div class="flex items-center gap-2">
            <button
              class="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              :disabled="!phoneE164 || sending"
              @click="sendCode"
            >
              {{ sending ? 'در حال ارسال…' : 'ارسال کد' }}
            </button>
            <span v-if="smsSent" class="text-sm text-gray-600">کد ارسال شد</span>
          </div>

          <div v-if="smsSent" class="mt-2 space-y-2">
            <input v-model="smsCode" class="border rounded px-3 py-2 w-full" placeholder="کد پیامک" />
            <button
              type="button"
              class="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
              :disabled="verifying || !smsCode || smsCode.length < 4"
              @click="verifyCode"
            >
              {{ verifying ? 'در حال بررسی…' : 'ادامه' }}
            </button>

          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>

        <!-- Step 2: Username (+ Password) -->
        <div v-else-if="step === 2" class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold">ثبت‌نام - مرحله ۲</div>

          <label class="text-sm">یوزرنیم</label>
          <input v-model="username" class="border rounded px-3 py-2 w-full" placeholder="مثلاً ali_1370" />
          <div
            class="text-xs"
            :class="uCheck.ok === true ? 'text-green-600' : uCheck.ok === false ? 'text-red-600' : 'text-gray-500'"
          >
            <span v-if="uCheck.loading">در حال بررسی…</span>
            <span v-else>{{ uCheck.msg }}</span>
          </div>

          <label class="text-sm">رمز عبور</label>
          <input type="password" v-model="password" class="border rounded px-3 py-2 w-full" placeholder="حداقل ۶ کاراکتر" />

          <div class="flex items-center justify-between mt-2">
            <button class="px-3 py-2 rounded border" @click="step = 1">بازگشت</button>
            <button
              class="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              :disabled="!username || uCheck.ok !== true || !password || password.length < 6"
              @click="goStep3"
            >
              ادامه
            </button>
          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>

        <!-- Step 3: Names → displayName -->
        <div v-else class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold">ثبت‌نام - مرحله ۳</div>

          <label class="text-sm">نام</label>
          <input v-model="firstName" class="border rounded px-3 py-2 w-full" placeholder="الزامی" />

          <label class="text-sm">نام‌خانوادگی (اختیاری)</label>
          <input v-model="lastName" class="border rounded px-3 py-2 w-full" placeholder="اختیاری" />

          <div class="text-xs text-gray-600">
            نام نمایشی: <span class="font-medium">{{ displayName || '—' }}</span>
          </div>

          <div class="flex items-center justify-between mt-2">
            <button class="px-3 py-2 rounded border" @click="step = 2">بازگشت</button>
            <button
              class="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
              :disabled="!firstName || loading"
              @click="completeRegister"
            >
              {{ loading ? 'در حال ثبت…' : 'اتمام ثبت‌نام' }}
            </button>
          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>


      <p v-if="error" class="text-red-600 text-sm mt-4 text-center">{{ error }}</p>

      <div class="text-center mt-6">
        <RouterLink to="/login" class="text-indigo-600 hover:underline">ورود</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import PhoneInput from "../components/PhoneInput.vue";

import {
  registerWithPhone,
  requestSmsCode,
  loginWithSms,
  storeTokenFromAuthResponse,
  // NEW:
  checkUsername,
  updateMyProfile,
} from "../services/api";

const router = useRouter();

// Steps: 1=phone/code, 2=username/password, 3=names
const step = ref<1 | 2 | 3>(1);

// --- Step 1: phone & code ---
const phoneE164 = ref<string | null>(null);   // set by <PhoneInput v-model:e164="phoneE164" />
const smsSent = ref(false);
const smsCode = ref("");
const sending = ref(false);
const error = ref<string | null>(null);
const verifying = ref(false)

async function sendCode() {
  error.value = null;
  if (!phoneE164.value) return;
  try {
    if (!phoneE164.value) { error.value = 'شماره معتبر نیست.'; return; }
    sending.value = true;
    await requestSmsCode({ phoneNumber: phoneE164.value as string });
    smsSent.value = true;
  } catch (e: any) {
    error.value = e?.response?.data || "خطا در ارسال کد";
  } finally {
    sending.value = false;
  }
}

// مثل تلگرام: اگر شماره از قبل اکانت داشته باشد، با کد وارد می‌شود.
// اگر وجود نداشت/کد نامعتبر بود ⇒ می‌رویم مرحله ۲ برای ساخت حساب جدید.
async function verifyCode() {
  error.value = null
  if (!phoneE164.value || !smsCode.value || verifying.value) return
  verifying.value = true
  try {
    const authResp = await loginWithSms({
      phoneNumber: phoneE164.value,
      code: smsCode.value,
    })
    // حساب موجود بود ⇒ مستقیم وارد شو
    storeTokenFromAuthResponse(authResp)
    router.push('/chat')
  } catch (e: any) {
    const status = e?.response?.status
    const detail = e?.response?.data?.Detail || e?.response?.data || ''
    // اگر حسابی برای این شماره نیست/کد برای «ورود» معتبر نیست ⇒ برو مرحله ۲
    if (
      (typeof detail === 'string' && detail.includes('No account')) ||
      status === 400 || status === 404
    ) {
      step.value = 2
      // خطا نشان نده؛ کاربر وارد مرحله ساخت حساب می‌شود
    } else {
      error.value = 'خطا در تأیید کد'
    }
  } finally {
    verifying.value = false
  }
}


// --- Step 2: username + password ---
const username = ref("");
const password = ref("");

const uCheck = ref<{ loading: boolean; ok: boolean | null; msg: string }>({
  loading: false,
  ok: null,
  msg: "",
});

let uTimer: number | null = null;
watch(username, (v) => {
  if (uTimer) clearTimeout(uTimer);
  if (!v) {
    uCheck.value = { loading: false, ok: null, msg: "" };
    return;
  }
  uCheck.value = { loading: true, ok: null, msg: "" };
  uTimer = window.setTimeout(async () => {
    try {
      if (v.length < 3) {
        uCheck.value = { loading: false, ok: null, msg: "حداقل ۳ کاراکتر" };
        return;
      }
      const { available } = await checkUsername(v);
      uCheck.value = available
        ? { loading: false, ok: true, msg: "در دسترس" }
        : { loading: false, ok: false, msg: "قبلاً گرفته شده" };
    } catch {
      uCheck.value = { loading: false, ok: null, msg: "خطا در بررسی" };
    }
  }, 350);
});

function goStep3() {
  if (!username.value || uCheck.value.ok !== true) return;
  if (!password.value || password.value.length < 6) return;
  step.value = 3;
}

// --- Step 3: names → displayName ---
const firstName = ref("");
const lastName = ref(""); // optional

const displayName = computed(() => {
  const f = (firstName.value || "").trim();
  const l = (lastName.value || "").trim();
  return f && l ? `${f} ${l}` : f || l;
});

const loading = ref(false);
async function completeRegister() {
  if (!phoneE164.value || !smsCode.value) return;
  if (!username.value || uCheck.value.ok !== true) return;
  if (!password.value || password.value.length < 6) return;

  loading.value = true;
  error.value = null;
  try {
    // ساخت حساب جدید
    const auth = await registerWithPhone({
      username: username.value,
      password: password.value,
      phoneNumber: phoneE164.value,
    });

    storeTokenFromAuthResponse(auth);

    if (displayName.value) {
      await updateMyProfile({ displayName: displayName.value })
    }

    router.push("/chat");
  } catch (e: any) {
    error.value = e?.response?.data || "خطا در ثبت‌نام";
  } finally {
    loading.value = false;
  }
}
</script>


<style scoped>
@reference "tailwindcss";
.input {
  @apply border rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500;
}
.btn-primary {
  @apply bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:opacity-60;
}
</style>
