
export const ACCESS_TOKEN_KEY = 'access_token'

export function getToken(): string | null {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY) } catch { return null }
}

export function setToken(token: string) {
  try { localStorage.setItem(ACCESS_TOKEN_KEY, token) } catch {}
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
    return JSON.parse(atob(payload))
  } catch { return null }
}

export function isJwtExpired(token?: string | null): boolean {
  const p = parseJwt(token)
  if (!p?.exp) return true
  const nowSec = Math.floor(Date.now() / 1000)
  return p.exp <= nowSec
}
