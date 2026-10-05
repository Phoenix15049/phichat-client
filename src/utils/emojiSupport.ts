let flagSupport: boolean | null = null

/**
 * Whether this system draws flag emoji. Windows does not: a flag shows as two letters, so
 * the pair is about twice as wide as one regional indicator.
 */
export function supportsFlagEmoji(): boolean {
  if (flagSupport !== null) return flagSupport
  try {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return (flagSupport = true)
    context.font = "32px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
    const pair = context.measureText('\u{1F1EE}\u{1F1F7}').width
    const single = context.measureText('\u{1F1EE}').width
    flagSupport = pair < single * 1.5
  } catch {
    flagSupport = true
  }
  return flagSupport
}
