<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="bg-white p-6 rounded shadow-md w-full max-w-sm">
      <h2 class="text-xl font-semibold mb-4 text-center">ثبت‌نام</h2>

      <form @submit.prevent="register">
        <input
          v-model="username"
          type="text"
          placeholder="نام کاربری"
          class="w-full mb-3 px-3 py-2 border rounded"
        />

        <input
          v-model="password"
          type="password"
          placeholder="رمز عبور"
          class="w-full mb-3 px-3 py-2 border rounded"
        />

        <button
          type="submit"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
        >
          ثبت‌نام
        </button>
      </form>

      <p class="text-sm text-red-500 mt-3" v-if="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { generateKeyPair } from '../services/crypto'

const username = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

const register = async () => {
  error.value = ''

  try {
    const { publicKey, privateKey } = await generateKeyPair()

    await axios.post('https://localhost:7146/api/auth/register', {
      username: username.value,
      password: password.value,
      publicKey
    })

    localStorage.setItem('privateKey', privateKey)
    router.push('/login')
  } catch (err: any) {
    error.value = err.response?.data?.message || 'ثبت‌نام ناموفق بود'
  }
}
</script>
