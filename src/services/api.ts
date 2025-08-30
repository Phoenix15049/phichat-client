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
    return res.data 
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


export async function getConversations() {
  const { data } = await API.get('/messages/conversations')

  return data as Array<{
    peerId: string
    peerUsername: string
    peerDisplayName?: string
    peerAvatarUrl?: string
    lastEncryptedContent?: string
    lastFileUrl?: string
    lastSentAt: string
    unreadCount: number
  }>
}





// --- ADD below existing imports ---
export interface RegisterWithPhoneRequest {
  username: string;
  password: string;
  phoneNumber: string;
}
export interface RequestSmsCodeRequest {
  phoneNumber: string;
}
export interface LoginWithSmsRequest {
  phoneNumber: string;
  code: string;
}


// helper to read token in both cases (camelCase/PascalCase)
function extractToken(data: any): string | undefined {
  return data?.token ?? data?.Token;
}

// --- ADD these API functions near other auth functions ---
export async function registerWithPhone(payload: RegisterWithPhoneRequest) {
  const { data } = await API.post("/auth/register-phone", payload);
  return data;
}

export async function requestSmsCode(payload: RequestSmsCodeRequest) {
  await API.post("/auth/request-sms-code", payload);
}

export async function loginWithSms(payload: LoginWithSmsRequest) {
  const { data } = await API.post("/auth/login-sms", payload);
  return data;
}

// (Optional) small helper if you want one place to store token
export function storeTokenFromAuthResponse(data: any) {
  const token = extractToken(data);
  if (!token) throw new Error("Token not found in response.");
  localStorage.setItem("token", token);
}

export async function getConversationPaged(userId: string, beforeId?: string, pageSize = 50) {
  const params: any = { pageSize };
  if (beforeId) params.beforeId = beforeId;
  const { data } = await API.get(`/messages/with-paged/${userId}`, { params });
  return data; // { items: ReceivedMessageResponse[], hasMore: boolean, oldestId?: string }
}

export async function editMessage(id: string, encryptedText: string) {
  const { data } = await API.put(`/messages/${id}`, { encryptedText });
  return data;
}

export async function deleteMessage(id: string, scope: 'me'|'all'='me') {
  await API.delete(`/messages/${id}`, { params: { scope } });
}


export async function addReaction(messageId: string, emoji: string) {
  await API.post(`/messages/${messageId}/reactions`, { emoji });
}
export async function removeReaction(messageId: string, emoji: string) {
  await API.delete(`/messages/${messageId}/reactions`, { params: { emoji } });
}


export async function checkUsername(u: string) {
  const { data } = await API.get('/users/check-username', { params: { u } })
  return data as { available: boolean }
}


export async function updateDisplayName(displayName: string) {
  await API.patch('/users/display-name', displayName, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}

export async function getMessageBrief(id: string) {
  const { data } = await API.get(`/messages/${id}/brief`)
  return data as {
    messageId: string
    senderId: string
    receiverId: string
    encryptedContent: string | null
    fileUrl: string | null
    sentAt: string
  }
}

export async function uploadAvatar(formData: FormData): Promise<string> {
  const res = await API.post('/users/avatar', formData)
  const url: string = res.data.url
  return `https://localhost:7146${url.startsWith('/') ? url : '/' + url}`
}

export async function getUsersList() {
  const { data } = await API.get('/users/list')
  return data as Array<{
    id: string; username: string; displayName?: string; avatarUrl?: string; lastSeenUtc?: string | null
  }>
}

export async function getOnlineUsers() {
  // از SignalR می‌گیریم (invoke)، پس این تابع را در signalr.ts می‌سازیم نه اینجا
  return [] as string[]
}

export async function sendMessageWithFileFD(fd: FormData) {
  return API.post('/messages/with-file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
