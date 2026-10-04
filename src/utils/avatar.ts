/** Initials for an avatar placeholder: first letters of the first two words. */
export function initialsOf(name?: string | null, fallback = '?'): string {
  return (
    (name ?? '')
      .trim()
      .replace(/^@/, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || fallback
  )
}

/** Stable background colour for an avatar placeholder, derived from a name. */
export function colorFromString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`
}
