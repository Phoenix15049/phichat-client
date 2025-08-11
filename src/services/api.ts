// src/services/api.ts
import axios from 'axios'
import { getToken } from '../utils/jwt'

export const API = axios.create({
  baseURL: 'https://localhost:7146/api'
})

API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function getConversationWith(userId: string) {
  const res = await API.get(`/messages/with/${userId}`)
  return res.data
}

export async function getMyMessages() {
  const res = await API.get('/messages')
  return res.data
}

export async function getChatKey(userId: string): Promise<string | null> {
  try {
    const res = await API.get(`/keys/${userId}`)
    return res.data // base64 string
  } catch (err: any) {
    if (err.response?.status === 404) return null
    throw err
  }
}

export type StoreChatKeyPayload = { receiverId: string; encryptedKey: string }

export async function storeChatKey(payload: StoreChatKeyPayload) {
  return API.post('/keys', payload, {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function getUserList() {
  const res = await API.get('/users/list')
  return res.data
}

export async function getUserById(userId: string) {
  const res = await API.get(`/users/${userId}`)
  return res.data
}

export async function uploadEncryptedFile(formData: FormData): Promise<string> {
  const res = await API.post('/messages/upload', formData)
  const url: string = res.data.url
  return `https://localhost:7146${url.startsWith('/') ? url : '/' + url}`
}

export async function getUserByUsername(username: string) {
  const { data } = await API.get(`/users/by-username/${encodeURIComponent(username)}`)
  return data
}

export async function getMeProfile() {
  const { data } = await API.get('/users/me')
  return data
}

export async function updateMyProfile(payload: { displayName?: string; avatarUrl?: string; bio?: string }) {
  await API.put('/users/profile', payload)
}


export async function getMyContacts() {
  const { data } = await API.get('/contacts')
  return data as Array<{ contactId: string; username: string; displayName?: string; avatarUrl?: string }>
}

export async function addContact(contactId: string) {
  await API.post(`/contacts/${contactId}`)
}

export async function removeContact(contactId: string) {
  await API.delete(`/contacts/${contactId}`)
}
