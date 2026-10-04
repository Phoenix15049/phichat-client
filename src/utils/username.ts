/** "@ali " -> "ali" */
export function normalizeUsername(username: string) {
  return username.replace(/^@/, '').trim()
}
