const DEFAULT_SERVER_ORIGIN = 'https://localhost:7146'

export const SERVER_ORIGIN = (
  import.meta.env.VITE_SERVER_ORIGIN || DEFAULT_SERVER_ORIGIN
).replace(/\/+$/, '')

export const API_BASE_URL = `${SERVER_ORIGIN}/api`
export const CHAT_HUB_URL = `${SERVER_ORIGIN}/chat`

export function toAbsoluteServerUrl(
  url: string | null | undefined
): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${SERVER_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`
}