// src/services/api.ts
import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { API_BASE_URL, toAbsoluteServerUrl } from '../config/server'
import { getToken, clearAuthLocal, clearToken, isJwtExpired, setToken } from './auth'
import { i18n, t } from '../i18n'
import { deleteOtherIdentities } from './e2ee/keyStore'
import type { KeyBackup } from './e2ee/primitives'
import type {
  Contact,
  ConversationPage,
  ServerMessage,
  UserApiItem
} from '../types/chat'


export const API = axios.create({
  baseURL: API_BASE_URL,
  // Needed for the HttpOnly refresh-token cookie when the API is on another origin.
  withCredentials: true
})

// ---------------- Session / token refresh ----------------

export type AuthResponse = {
  token: string
  expiresAtUtc: string
  userId: string
  username: string
}

/** Refresh this long before the access token actually expires. */
const REFRESH_MARGIN_SECONDS = 30

let refreshInFlight: Promise<string | null> | null = null
let sessionExpiredHandler: (() => void) | null = null

/** Called once the session cannot be renewed (refresh token missing, expired or revoked). */
export function onSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler
}

function isAuthEndpoint(url?: string) {
  return !!url && /(^|\/)auth\//.test(url)
}

/**
 * Exchanges the refresh-token cookie for a new access token.
 * Concurrent callers share one request; resolves to null when the session is over.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const { data } = await API.post<AuthResponse>('/auth/refresh')
      if (!data?.token) return null
      setToken(data.token)
      return data.token
    } catch (err) {
      const status = (err as AxiosError)?.response?.status
      if (status === 401) {
        clearToken()
        return null
      }
      // Network / server error: keep the current token, the caller may retry later.
      throw err
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/** A usable access token, refreshing it first when it is expired or about to expire. */
export async function getValidAccessToken(): Promise<string | null> {
  const token = getToken()
  if (token && !isJwtExpired(token, REFRESH_MARGIN_SECONDS)) return token
  if (!token) return null

  try {
    return await refreshAccessToken()
  } catch {
    return token
  }
}

API.interceptors.request.use(async config => {
  if (isAuthEndpoint(config.url)) return config

  const token = await getValidAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retried ||
      isAuthEndpoint(original.url)
    ) {
      throw error
    }

    original._retried = true

    let token: string | null = null
    try {
      token = await refreshAccessToken()
    } catch {
      throw error
    }

    if (!token) {
      sessionExpiredHandler?.()
      throw error
    }

    original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${token}` }
    return API(original)
  }
)

/**
 * Human-readable message from an API error, in the UI language when the server's error
 * code is known; otherwise ProblemDetails `detail`, the first validation error, or `fallback`.
 */
export function getErrorMessage(err: unknown, fallback?: string): string {
  const e = err as AxiosError<any>
  const data = e?.response?.data
  const defaultMessage = fallback ?? t('errors.generic')

  if (!e?.response) {
    // Hub and encryption errors carry a code without an HTTP response.
    const code = getErrorCode(err)
    if (code && i18n.global.te(`errors.${code}`)) return t(`errors.${code}`)
    return e?.message === 'Network Error' ? t('errors.network') : defaultMessage
  }

  const code = getErrorCode(err) ?? (e.response.status === 429 ? 'rate_limited' : null)
  if (code && i18n.global.te(`errors.${code}`)) return t(`errors.${code}`)

  if (typeof data === 'string' && data.trim()) return data

  if (data && typeof data === 'object') {
    if (data.errors && typeof data.errors === 'object') {
      const first = Object.values(data.errors as Record<string, string[]>).flat()[0]
      if (first) return first
    }
    if (typeof data.detail === 'string' && data.detail) return data.detail
    if (typeof data.title === 'string' && data.title) return data.title
  }

  return defaultMessage
}

/**
 * Machine-readable error code (e.g. "no_account") from a ProblemDetails response, an
 * E2eeError, or a hub error ("HubException: code: message").
 */
export function getErrorCode(err: unknown): string | null {
  const data = (err as AxiosError<any>)?.response?.data
  if (data && typeof data === 'object' && typeof data.code === 'string') return data.code

  const code = (err as { code?: unknown })?.code
  if ((err as Error)?.name === 'E2eeError' && typeof code === 'string') return code

  const hub = /HubException: ([a-z_]+):/.exec(String((err as Error)?.message ?? ''))
  return hub ? hub[1] : null
}

// ---------------- Auth ----------------

/** Stores a fresh sign-in. Clears per-user local data left by a previous account. */
export function storeTokenFromAuthResponse(data: Partial<AuthResponse> | null | undefined) {
  const token = data?.token ?? ''
  if (!token) return
  clearAuthLocal()
  setToken(token)
}

export async function loginWithPassword(username: string, password: string): Promise<AuthResponse> {
  const { data } = await API.post<AuthResponse>('/auth/login', { username, password })
  return data
}

export interface RequestSmsCodeRequest {
  phoneNumber: string;
}
export interface LoginWithSmsRequest {
  phoneNumber: string;
  code: string;
}
export interface RegisterWithPhoneRequest {
  username: string;
  password: string;
  /** From verifyPhone(); proves the phone number was verified by SMS. */
  registrationToken: string;
}
export type VerifyPhoneResponse = {
  isNewUser: boolean
  registrationToken?: string | null
  auth?: AuthResponse | null
}

export async function requestSmsCode(payload: RequestSmsCodeRequest) {
  await API.post("/auth/request-sms-code", payload);
}

/** Verifies an SMS code: signs in an existing account, or returns a registration token. */
export async function verifyPhone(payload: LoginWithSmsRequest): Promise<VerifyPhoneResponse> {
  const { data } = await API.post<VerifyPhoneResponse>("/auth/verify-phone", payload);
  return data;
}

export async function loginWithSms(payload: LoginWithSmsRequest): Promise<AuthResponse> {
  const { data } = await API.post<AuthResponse>("/auth/login-sms", payload);
  return data;
}

export async function registerWithPhone(payload: RegisterWithPhoneRequest): Promise<AuthResponse> {
  const { data } = await API.post<AuthResponse>("/auth/register-phone", payload);
  return data;
}

/**
 * Revokes the session on the server (best effort) and forgets local auth data, including
 * this device's encryption key: signing in again needs the recovery passphrase.
 */
export async function logout() {
  try {
    await API.post('/auth/logout')
  } catch {}
  clearAuthLocal()
  await deleteOtherIdentities(null)
}

// ---------------- Users / contacts ----------------

/** Avatars are stored as server-relative paths; make them loadable from the app origin. */
function withAbsoluteAvatar<T extends { avatarUrl?: string | null; AvatarUrl?: string | null }>(user: T): T {
  if (!user) return user
  const raw = user.avatarUrl ?? user.AvatarUrl
  return raw ? { ...user, avatarUrl: toAbsoluteServerUrl(raw) } : user
}

// ---------------- End-to-end encryption keys ----------------

export type PublicIdentityKey = {
  userId: string
  keyId: string
  publicKey: string
  createdAtUtc: string
  revokedAtUtc?: string | null
}

export type MyIdentityKey = {
  keyId: string
  publicKey: string
  createdAtUtc: string
  backup: KeyBackup
}

export type PublishIdentityKeyPayload = { publicKey: string; backup: KeyBackup }

/** The signed-in user's key and its encrypted backup, or null before the first setup. */
export async function getMyIdentityKey(): Promise<MyIdentityKey | null> {
  const res = await API.get<MyIdentityKey | ''>('/keys/me')
  return res.status === 204 || !res.data ? null : res.data
}

export async function createIdentityKey(payload: PublishIdentityKeyPayload): Promise<MyIdentityKey> {
  return (await API.post<MyIdentityKey>('/keys/me', payload)).data
}

/** Replaces the key (lost passphrase): earlier messages become unreadable on every device. */
export async function replaceIdentityKey(payload: PublishIdentityKeyPayload): Promise<MyIdentityKey> {
  return (await API.put<MyIdentityKey>('/keys/me', payload)).data
}

export async function updateKeyBackup(keyId: string, backup: KeyBackup): Promise<void> {
  await API.put('/keys/me/backup', { keyId, backup })
}

/** A user's current public key, or null if they have not set up encryption yet. */
export async function getActiveIdentityKey(userId: string): Promise<PublicIdentityKey | null> {
  try {
    return (await API.get<PublicIdentityKey>(`/keys/${userId}`)).data
  } catch (err) {
    if (getErrorCode(err) === 'no_identity_key') return null
    throw err
  }
}

/** A specific (possibly replaced) public key, to read older messages. */
export async function getIdentityKeyById(userId: string, keyId: string): Promise<PublicIdentityKey> {
  return (await API.get<PublicIdentityKey>(`/keys/${userId}/${encodeURIComponent(keyId)}`)).data
}


export async function getUserById(
  userId: string
): Promise<UserApiItem> {
  const res = await API.get(`/users/${userId}`)
  return withAbsoluteAvatar(res.data)
}

export async function getUserByUsername(
  username: string
): Promise<UserApiItem> {
  const { data } = await API.get(`/users/by-username/${encodeURIComponent(username)}`)
  return withAbsoluteAvatar(data)
}

export async function getMeProfile(): Promise<UserApiItem> {
  const { data } = await API.get('/users/me')
  return withAbsoluteAvatar(data)
}

export async function updateMyProfile(payload: { displayName?: string; avatarUrl?: string; bio?: string }) {
  await API.put('/users/profile', payload)
}


export async function getMyContacts(): Promise<Contact[]> {
  const { data } = await API.get('/contacts')
  return (data as Contact[]).map(withAbsoluteAvatar)
}

export async function addContact(contactId: string) {
  await API.post(`/contacts/${contactId}`)
}

export async function removeContact(contactId: string) {
  await API.delete(`/contacts/${contactId}`)
}


export async function getConversations() {
  const { data } = await API.get('/messages/conversations')

  return (data as Array<{
    peerId: string
    peerUsername: string
    peerDisplayName?: string
    peerAvatarUrl?: string
    lastSenderId?: string
    lastEncryptedContent?: string
    lastFileUrl?: string
    lastSentAt: string
    unreadCount: number
  }>).map(c => (c.peerAvatarUrl ? { ...c, peerAvatarUrl: toAbsoluteServerUrl(c.peerAvatarUrl) } : c))
}


export async function getConversationPaged(
  userId: string,
  beforeId?: string,
  pageSize = 50
): Promise<ConversationPage> {
  const params: { pageSize: number; beforeId?: string } = { pageSize }
  if (beforeId) params.beforeId = beforeId

  const { data } = await API.get(`/messages/with-paged/${userId}`, { params })
  const items = (data?.items ?? data?.Items ?? []) as ServerMessage[]
  const first = items[0]

  return {
    items,
    hasMore: Boolean(data?.hasMore ?? data?.HasMore),
    oldestId:
      data?.oldestId ??
      data?.OldestId ??
      first?.messageId ??
      first?.MessageId ??
      first?.id ??
      null
  }
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
  return toAbsoluteServerUrl(url)
}

export async function sendMessageWithFileFD(fd: FormData) {
  return API.post('/messages/with-file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
