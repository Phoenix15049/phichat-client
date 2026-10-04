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
              class="px-3 py-2 rounded bg-[#11BFAE] hover:bg-[#10B2A3] text-white disabled:opacity-50 inline-flex items-center gap-2"
              :disabled="!phoneE164 || sending" @click="sendCode">
              <template v-if="sending"><Loader2 class="w-4 h-4 animate-spin" /><span>Sending…</span></template>
              <template v-else><Send class="w-4 h-4" /><span>Send code</span></template>
            </button>
            <span v-if="smsSent" class="text-sm text-gray-600 inline-flex items-center gap-1.5">
              <Check class="w-4 h-4" /><span>Code sent</span>
            </span>

          </div>

          <div v-if="smsSent" class="mt-2 space-y-2">
            <input v-model.trim="smsCode" class="input" inputmode="numeric" maxlength="6" placeholder="6-digit code" />
            <button type="button"
              class="px-3 py-2 rounded bg-[#1B3C59] hover:bg-[#16344B] text-white disabled:opacity-50 inline-flex items-center gap-2"
              :disabled="verifying || !/^\d{6}$/.test(smsCode)" @click="verifyCode">
              <template v-if="verifying"><Loader2 class="w-4 h-4 animate-spin" /><span>Verifying…</span></template>
              <template v-else><ShieldCheck class="w-4 h-4" /><span>Verify & continue</span></template>
            </button>

          </div>

          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
        </div>

        <!-- Step 2: Username (+ Password) -->
        <div v-else-if="step === 2" key="step2" class="max-w-sm mx-auto p-4 space-y-3">
          <div class="text-lg font-semibold text-[#1B3C59]">Step 2 — Username & password</div>

          <label class="text-sm text-[#456173]">Username</label>
          <input v-model="username" class="input" placeholder="e.g. ali_1370" />
          <div class="text-xs inline-flex items-center gap-1.5"
              :class="uCheck.ok === true ? 'text-green-600' : uCheck.ok === false ? 'text-red-600' : 'text-gray-500'">
            <template v-if="uCheck.loading">
              <Loader2 class="w-3.5 h-3.5 animate-spin" /><span>Checking…</span>
            </template>
            <template v-else-if="uCheck.ok === true">
              <Check class="w-3.5 h-3.5" /><span>Available</span>
            </template>
            <template v-else-if="uCheck.ok === false">
              <XIcon class="w-3.5 h-3.5" /><span>Already taken</span>
            </template>
            <template v-else>
              <span>{{ uCheck.msg }}</span>
            </template>
          </div>
          <div></div>
          <label class="text-sm text-[#456173]">Password</label>
          <input type="password" v-model="password" class="input" placeholder="At least 8 characters" />

          <div class="flex items-center justify-between mt-2">
            <button class="px-3 py-2 rounded border border-[#456173]/30 text-[#456173] inline-flex items-center gap-2"
                    @click="step = 1">
              <ArrowLeft class="w-4 h-4" /><span>Back</span>
            </button>
            <button
              class="px-3 py-2 rounded bg-[#11BFAE] hover:bg-[#10B2A3] text-white disabled:opacity-50 inline-flex items-center gap-2"
              :disabled="!username || uCheck.ok !== true || !password || password.length < PASSWORD_MIN"
              @click="goStep3">
              <ArrowRight class="w-4 h-4" /><span>Next</span>
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
            <button class="px-3 py-2 rounded border border-[#456173]/30 text-[#456173] inline-flex items-center gap-2"
                    @click="step = 2">
              <ArrowLeft class="w-4 h-4" /><span>Back</span>
            </button>
            <button
              class="px-3 py-2 rounded bg-[#1B3C59] hover:bg-[#16344B] text-white disabled:opacity-50 inline-flex items-center gap-2"
              :disabled="!firstName || loading" @click="completeRegister">
              <template v-if="loading"><Loader2 class="w-4 h-4 animate-spin" /><span>Saving…</span></template>
              <template v-else><Check class="w-4 h-4" /><span>Finish</span></template>
            </button>
          </div>


          <p v-if="error" class="text-xs text-red-600 mt-2 inline-flex items-center gap-1.5">
            <AlertCircle class="w-4 h-4" /><span>{{ error }}</span>
          </p>

        </div>
      </transition>

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
  Send, Loader2, Check, ShieldCheck, ArrowRight, ArrowLeft, X as XIcon, AlertCircle
} from 'lucide-vue-next'

import {
  registerWithPhone,
  requestSmsCode,
  verifyPhone,
  storeTokenFromAuthResponse,
  checkUsername,
  updateMyProfile,
  getErrorCode,
  getErrorMessage,
} from "../services/api";

const USERNAME_MIN = 4;
const USERNAME_MAX = 32;
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const PASSWORD_MIN = 8;

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

// Issued by the server once the phone is verified; required to create the account.
const registrationToken = ref<string | null>(null);

async function sendCode() {
  error.value = null;
  if (!phoneE164.value) return;
  try {
    if (!phoneE164.value) { error.value = 'Invalid phone number.'; return; }
    sending.value = true;
    await requestSmsCode({ phoneNumber: phoneE164.value as string });
    smsSent.value = true;
  } catch (e: any) {
    error.value = getErrorMessage(e, "Failed to send code");
  } finally {
    sending.value = false;
  }
}

async function verifyCode() {
  error.value = null
  if (!phoneE164.value || !smsCode.value || verifying.value) return
  verifying.value = true
  try {
    const result = await verifyPhone({
      phoneNumber: phoneE164.value,
      code: smsCode.value,
    })

    if (!result.isNewUser && result.auth) {
      // The phone already has an account: this is just a sign-in.
      storeTokenFromAuthResponse(result.auth)
      await router.push('/chat')
      return
    }

    registrationToken.value = result.registrationToken ?? null
    step.value = 2
  } catch (e: any) {
    error.value = getErrorMessage(e, 'Code verification failed')
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
      if (v.length < USERNAME_MIN || v.length > USERNAME_MAX) {
        uCheck.value = { loading: false, ok: null, msg: `${USERNAME_MIN}-${USERNAME_MAX} characters` };
        return;
      }
      if (!USERNAME_PATTERN.test(v)) {
        uCheck.value = { loading: false, ok: null, msg: "Only English letters, digits and _" };
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
  if (!password.value || password.value.length < PASSWORD_MIN) return;
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
  if (!registrationToken.value) {
    step.value = 1;
    error.value = "Please verify your phone number first.";
    return;
  }
  if (!username.value || uCheck.value.ok !== true) return;
  if (!password.value || password.value.length < PASSWORD_MIN) return;

  loading.value = true;
  error.value = null;

  try {
    const auth = await registerWithPhone({
      username: username.value,
      password: password.value,
      registrationToken: registrationToken.value,
    });

    storeTokenFromAuthResponse(auth);

    if (displayName.value) {
      try {
        await updateMyProfile({ displayName: displayName.value })
      } catch {
        // The account exists; the name can still be set later in Settings.
      }
    }

    await router.push('/chat')
  } catch (e: any) {
    if (getErrorCode(e) === 'phone_verification_invalid') {
      registrationToken.value = null;
      smsSent.value = false;
      smsCode.value = "";
      step.value = 1;
    }
    error.value = getErrorMessage(e, "Registration failed");
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
