// Empty origin = same origin as the app. In development the Vite dev server proxies
// /api, /hubs and /uploads to the backend (see vite.config.ts), which keeps the
// refresh-token cookie first-party. Set VITE_SERVER_ORIGIN only when the API is
// hosted on a different origin.
export const SERVER_ORIGIN = (
  import.meta.env.VITE_SERVER_ORIGIN || ''
).replace(/\/+$/, '')

export const API_BASE_URL = `${SERVER_ORIGIN}/api`
export const CHAT_HUB_URL = `${SERVER_ORIGIN}/hubs/chat`

export function toAbsoluteServerUrl(
  url: string | null | undefined
): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url
  return `${SERVER_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`
}
