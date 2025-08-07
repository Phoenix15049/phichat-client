<template>
  <div class="flex items-center justify-center h-screen bg-gray-100">
    <form @submit.prevent="handleLogin" class="bg-white p-8 rounded shadow-md w-full max-w-sm space-y-4">
      <h1 class="text-xl font-bold text-center">ورود به PhiChat</h1>

      <input v-model="username" type="text" placeholder="نام کاربری" class="border rounded w-full px-3 py-2" />
      <input v-model="password" type="password" placeholder="رمز عبور" class="border rounded w-full px-3 py-2" />

      <button class="bg-blue-600 text-white px-4 py-2 rounded w-full">ورود</button>

      <p class="text-sm text-center">
        حساب ندارید؟
        <router-link to="/register" class="text-blue-600 underline">ثبت‌نام</router-link>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API } from '../services/api'

const username = ref('')
const password = ref('')
const router = useRouter()

async function handleLogin() {
  try {
    const res = await API.post('/auth/login', {
      username: username.value,
      password: password.value
    })

    const token = res.data.token
    localStorage.setItem('token', token)

    router.push('/chat')
  } catch (err) {
    console.error('❌ Login failed:', err)
    alert('ورود ناموفق. لطفاً اطلاعات را بررسی کنید.')
  }
}
</script>
