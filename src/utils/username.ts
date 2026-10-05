/** "@ali " -> "ali" */
export function normalizeUsername(username: string) {
  return username.replace(/^@/, '').trim()
}

/**
 * Wraps a name for use inside a translated sentence so it keeps its own direction
 * ("@ali" stays "@ali" in a Persian sentence). Uses Unicode FSI ... PDI isolation.
 */
export function isolate(text: string) {
  return '\u2068' + text + '\u2069'
}
