import axios from 'axios'
import { getToken } from '../utils/jwt' // تابعی که توکن رو از localStorage می‌گیره

export const API = axios.create({
  baseURL: 'https://localhost:7146/api'
})

// 🛡 اتصال توکن به هر درخواست
API.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// پیام‌ها
export async function getConversationWith(userId: string) {
  const response = await API.get(`/messages/with/${userId}`)
  return response.data
}

export async function getMyMessages() {
  const response = await API.get('/messages')
  return response.data
}

// کلید چت
export async function getChatKey(userId: string): Promise<string | null> {
  try {
    const response = await API.get(`/keys/${userId}`)
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) return null
    throw error
  }
}

export async function storeChatKey(data: { receiverId: string; encryptedKey: string }) {
  console.log('📡 ارسال کلید رمزنگاری شده:', data)

  return await API.post('/keys', data, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}



// کاربران
export async function getUserList() {
  const response = await API.get('/users/list')
  return response.data
}

export async function getUserById(userId: string) {
  const response = await API.get(`/users/${userId}`)
  return response.data
}
