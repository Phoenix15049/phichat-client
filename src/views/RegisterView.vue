<template>
  <div class="min-h-screen flex items-center justify-center bg-[#F2F2F0] p-4" dir="ltr">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-6">
      <h1 class="text-xl font-bold mb-4 text-center text-[#1B3C59]">Create your PhiChat account</h1>


            <transition name="fade-up" mode="out-in">
        <!-- Step 1: Phone & Code -->
        <div v-if="step === 1" key="step1" class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold text-[#1B3C59]">Step 1 — Verify phone</div>

          <PhoneInput v-model="phoneE164" :defaultCountry="'IR'" />

          <div class="flex items-center gap-2">
            <button
              class="px-3 py-2 rounded bg-[#11BFAE] hover:bg-[#10B2A3] text-white disabled:opacity-50"
              :disabled="!phoneE164 || sending"
              @click="sendCode"
            >
              {{ sending ? 'Sending…' : 'Send code' }}
            </button>
            <span v-if="smsSent" class="text-sm text-gray-600">Code sent</span>
          </div>

          <div v-if="smsSent" class="mt-2 space-y-2">
            <input v-model="smsCode" class="input" placeholder="SMS code" />
            <button
              type="button"
              class="px-3 py-2 rounded bg-[#1B3C59] hover:bg-[#16344B] text-white disabled:opacity-50"
              :disabled="verifying || !smsCode || smsCode.length < 4"
              @click="verifyCode"
            >
              {{ verifying ? 'Verifying…' : 'Verify & continue' }}
            </button>
          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>

        <!-- Step 2: Username (+ Password) -->
        <div v-else-if="step === 2" key="step2" class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold text-[#1B3C59]">Step 2 — Username & password</div>

          <label class="text-sm text-[#456173]">Username</label>
          <input v-model="username" class="input" placeholder="e.g. ali_1370" />
          <div
            class="text-xs"
            :class="uCheck.ok === true ? 'text-green-600' : uCheck.ok === false ? 'text-red-600' : 'text-gray-500'"
          >
            <span v-if="uCheck.loading">Checking…</span>
            <span v-else>{{ uCheck.msg }}</span>
          </div>

          <label class="text-sm text-[#456173]">Password</label>
          <input type="password" v-model="password" class="input" placeholder="At least 6 characters" />

          <div class="flex items-center justify-between mt-2">
            <button class="px-3 py-2 rounded border border-[#456173]/30 text-[#456173]" @click="step = 1">Back</button>
            <button
              class="px-3 py-2 rounded bg-[#11BFAE] hover:bg-[#10B2A3] text-white disabled:opacity-50"
              :disabled="!username || uCheck.ok !== true || !password || password.length < 6"
              @click="goStep3"
            >
              Next
            </button>
          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>

        <!-- Step 3: Names → displayName -->
        <div v-else key="step3" class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold text-[#1B3C59]">Step 3 — Profile</div>

          <label class="text-sm text-[#456173]">First name</label>
          <input v-model="firstName" class="input" placeholder="Required" />

          <label class="text-sm text-[#456173]">Last name (optional)</label>
          <input v-model="lastName" class="input" placeholder="Optional" />

          <div class="text-xs text-gray-600">
            Display name: <span class="font-medium">{{ displayName || '—' }}</span>
          </div>

          <div class="flex items-center justify-between mt-2">
            <button class="px-3 py-2 rounded border border-[#456173]/30 text-[#456173]" @click="step = 2">Back</button>
            <button
              class="px-3 py-2 rounded bg-[#1B3C59] hover:bg-[#16344B] text-white disabled:opacity-50"
              :disabled="!firstName || loading"
              @click="completeRegister"
            >
              {{ loading ? 'Saving…' : 'Finish' }}
            </button>
          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>
      </transition>

      <p v-if="error" class="text-red-600 text-sm mt-4 text-center">{{ error }}</p>

      <div class="text-center mt-6">
        <RouterLink to="/login" class="text-[#11BFAE] hover:underline">Already have an account? Sign in</RouterLink>
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
    if (!phoneE164.value) { error.value = 'Invalid phone number.'; return; }
    sending.value = true;
    await requestSmsCode({ phoneNumber: phoneE164.value as string });
    smsSent.value = true;
  } catch (e: any) {
    error.value = e?.response?.data || "Failed to send code";
  } finally {
    sending.value = false;
  }
}

async function verifyCode() {
  error.value = null
  if (!phoneE164.value || !smsCode.value || verifying.value) return
  verifying.value = true
  try {
    const authResp = await loginWithSms({
      phoneNumber: phoneE164.value,
      code: smsCode.value,
    })

    storeTokenFromAuthResponse(authResp)

    router.push('/chat').then(() => {
      setTimeout(() => window.dispatchEvent(new Event('phichat:reinit')), 0)
    })
  } catch (e: any) {
    const status = e?.response?.status
    const detail = e?.response?.data?.Detail || e?.response?.data || ''

    if (
      (typeof detail === 'string' && detail.includes('No account')) ||
      status === 400 || status === 404
    ) {
      step.value = 2
    } else {
      error.value = 'Code verification failed'
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
      if (v.length < 4) {
        uCheck.value = { loading: false, ok: null, msg: "Minimum 4 characters" };
        return;
      }
      const { available } = await checkUsername(v);
      uCheck.value = available
        ? { loading: false, ok: true, msg: "Available" }
        : { loading: false, ok: false, msg: "Already taken" };
    } catch {
      uCheck.value = { loading: false, ok: null, msg: "Check failed" };
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

    if (displayName.value) await updateMyProfile({ displayName: displayName.value })

    router.push('/chat').then(() => {
      setTimeout(() => window.dispatchEvent(new Event('phichat:reinit')), 0)
    })
  } catch (e: any) {
    error.value = e?.response?.data || "Registration failed";
  } finally {
    loading.value = false;
  }
}
</script>


<style>
@reference "tailwindcss";
.input {
  @apply border rounded-lg px-3 py-2 w-full outline-none bg-white
         focus:ring-2 focus:ring-[#11BFAE]/60 focus:border-[#11BFAE];
}

/* step switch animation */
.fade-up-enter-from { opacity: 0; transform: translateY(8px) scale(.98); }
.fade-up-enter-active { transition: opacity .18s ease, transform .18s ease; }
.fade-up-leave-active { transition: opacity .12s ease, transform .12s ease; }
.fade-up-leave-to { opacity: 0; transform: translateY(-6px) scale(.98); }

</style>
