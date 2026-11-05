
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

/** localStorage entries that belong to the signed-in session and must not leak to the next account. */
const SESSION_KEY_PREFIXES = ['aeskey_']
const SESSION_KEYS = [ACCESS_TOKEN_KEY, 'phi.activeUserId']

/**
 * Forget the signed-in session: the access token and cached chat keys (keys are not
 * namespaced per account). Drafts are namespaced per user; signing out removes them (clearDrafts).
 */
export function clearAuthLocal() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (SESSION_KEYS.includes(key) || SESSION_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    }
  } catch {}
}

/** Unsent drafts are plain text, so they do not outlive the session (sign-out, not a new sign-in). */
export function clearDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('phi.draft.')) localStorage.removeItem(key)
    }
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
