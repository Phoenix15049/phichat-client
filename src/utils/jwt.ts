export function parseJwt(token: string): any {
  if (!token) return {}
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload))
}

export function getToken(): string | null {
  return localStorage.getItem('token')
}
