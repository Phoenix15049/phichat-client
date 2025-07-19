<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="bg-white p-6 rounded shadow-md w-full max-w-sm">
      <h2 class="text-xl font-semibold mb-4 text-center">ورود</h2>

      <form @submit.prevent="login">
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
          class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
        >
          ورود
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
import {decryptPrivateKeyWithPassword} from '../services/crypto'

const username = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()





const login = async () => {
  error.value = ''
  console.log('🚀 Start login')

  try {
    const res = await axios.post('https://localhost:7146/api/auth/login', {
      username: username.value,
      password: password.value
    })

    const token = res.data.token
    console.log('✅ Token received:', token)
    localStorage.setItem('token', token)

    const keyRes = await axios.get('https://localhost:7146/api/auth/private-key', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const encryptedPrivateKey = keyRes.data
    console.log('🔐 EncryptedPrivateKey:', encryptedPrivateKey)

    const privateKey = await decryptPrivateKeyWithPassword(encryptedPrivateKey, password.value)
    console.log('🔓 Decrypted PrivateKey:', privateKey)

    localStorage.setItem('privateKey', privateKey)
    console.log('💾 Saved to localStorage')

    await router.push('/chat').catch((e) => {
      console.error('❌ Navigation error:', e)
    })
    console.log('➡️ Redirected to /');

  } catch (err) {
    console.error('❌ Login error:', err)
    error.value = 'ورود ناموفق بود یا رمزگشایی شکست خورد.'
  }
}



</script>
