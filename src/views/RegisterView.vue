<template>
  
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow p-6">
      <h1 class="text-xl font-bold mb-4 text-center">ثبت‌نام در PhiChat</h1>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm mb-1">یوزرنیم</label>
          <input v-model.trim="username" type="text" class="w-full input" required minlength="3" />
        </div>
        <div>
          <label class="block text-sm mb-1">شماره موبایل (E.164)</label>
          <PhoneInput v-model="phoneE164" :defaultCountry="'IR'" label="شماره تلفن" />
          <p class="text-xs text-gray-500 mt-1">مثال: +98912… (شماره به‌صورت یکتا ذخیره می‌شود)</p>
        </div>
        <div>
          <label class="block text-sm mb-1">رمز عبور</label>
          <input v-model="password" type="password" class="w-full input" required minlength="6" />
        </div>

        <button :disabled="loading" class="btn-primary w-full">
          <span v-if="!loading">ثبت‌نام</span>
          <span v-else>در حال ثبت…</span>
        </button>
      </form>

      <p v-if="error" class="text-red-600 text-sm mt-4 text-center">{{ error }}</p>

      <div class="text-center mt-6">
        <RouterLink to="/login" class="text-indigo-600 hover:underline">ورود</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { registerWithPhone, storeTokenFromAuthResponse } from "../services/api";
import PhoneInput from '../components/PhoneInput.vue'
const username = ref("");
const phoneNumber = ref("");
const password = ref("");

const phoneE164 = ref<string | null>(null)


const loading = ref(false);
const error = ref<string | null>(null);

const router = useRouter();

function validPhone(p: string) {
  return /^\+?[1-9]\d{7,14}$/.test(p);
}

async function handleRegister() {
  if (!phoneE164.value || !validPhone(phoneE164.value)) {
  error.value = "فرمت شماره موبایل معتبر نیست.";
  return;
}


  loading.value = true;
  try {
    const data = await registerWithPhone({
      username: username.value,
      password: password.value,
      phoneNumber: phoneE164.value as string,
    });
    storeTokenFromAuthResponse(data);
    router.push("/chat");
  } catch (e: any) {
    error.value = e?.response?.data ?? e?.message ?? "ثبت‌نام ناموفق بود";
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
