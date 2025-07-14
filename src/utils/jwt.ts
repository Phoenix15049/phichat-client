export function parseJwt(token: string): any {
  if (!token) return {}
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload))
}
