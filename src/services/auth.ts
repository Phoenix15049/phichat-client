
export const ACCESS_TOKEN_KEY = 'access_token'

export function getToken(): string | null {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY) } catch { return null }
}

export function setToken(token: string) {
  try { localStorage.setItem(ACCESS_TOKEN_KEY, token) } catch {}
}

/** Forget the access token only (the refresh cookie is cleared by the server on logout). */
export function clearToken() {
  try { localStorage.removeItem(ACCESS_TOKEN_KEY) } catch {}
}

export function clearAuthLocal() {
  try {
    localStorage.clear()
  } catch {}
}

export function parseJwt(token?: string | null): any | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')))
  } catch { return null }
}

/** True when the token is missing, malformed, or expires within `marginSeconds`. */
export function isJwtExpired(token?: string | null, marginSeconds = 0): boolean {
  const p = parseJwt(token)
  if (!p?.exp) return true
  const nowSec = Math.floor(Date.now() / 1000)
  return p.exp - marginSeconds <= nowSec
}
