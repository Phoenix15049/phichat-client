/**
 * The full Unicode emoji set (emojibase) grouped like Telegram's picker, with English labels
 * and tags plus Persian keywords from Unicode CLDR for search. Loaded on first use only.
 */
import { ref } from 'vue'

export type EmojiItem = {
  /** Default (yellow) form. */
  unicode: string
  label: string
  /** Lower-cased search text: English label and tags, Persian keywords. */
  keywords: string
  /** Five skin-tone variants, light to dark, when the emoji has them. */
  skins?: string[]
}

export type EmojiGroupKey =
  | 'smileys' | 'people' | 'animals' | 'food' | 'travel' | 'activities' | 'objects' | 'symbols' | 'flags'

export type EmojiGroup = { key: EmojiGroupKey; items: EmojiItem[] }

// emojibase group number -> picker section (group 2 holds skin/hair components, not shown).
const GROUPS: Record<number, EmojiGroupKey> = {
  0: 'smileys', 1: 'people', 3: 'animals', 4: 'food', 5: 'travel', 6: 'activities', 7: 'objects', 8: 'symbols', 9: 'flags'
}
const ORDER: EmojiGroupKey[] = ['smileys', 'people', 'animals', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags']

type CompactEmoji = {
  unicode: string
  label: string
  group?: number
  order?: number
  tags?: string[]
  skins?: Array<{ unicode: string; order?: number }>
}

let loading: Promise<EmojiGroup[]> | null = null

const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
const SUPPORT_CACHE_KEY = 'phi.emoji.unsupported'

/**
 * Returns a test for whether the system can draw an emoji. An unknown code point renders as
 * the font's "missing glyph" box, and an unknown ZWJ sequence falls apart into several glyphs
 * (much wider than one emoji). Results are cached per browser.
 */
function createSupportCheck(): (emoji: string) => boolean {
  const cacheKey = `${SUPPORT_CACHE_KEY}:${navigator.userAgent}`
  let unsupported: Set<string> | null = null
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) unsupported = new Set(JSON.parse(cached))
  } catch {}
  if (unsupported) return emoji => !unsupported!.has(emoji)

  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return () => true

  context.font = `${size - 4}px ${EMOJI_FONT}`
  context.textBaseline = 'top'
  const pixels = (text: string) => {
    context.clearRect(0, 0, size, size)
    context.fillText(text, 0, 0)
    return context.getImageData(0, 0, size, size).data.join(',')
  }

  // Private-use code point: never an emoji, so it shows the missing-glyph box.
  const missing = pixels('\u{10FFFD}')
  const reference = context.measureText('\u{1F600}').width
  const found = new Set<string>()

  const check = (emoji: string) => {
    const ok = context.measureText(emoji).width <= reference * 1.4 && pixels(emoji) !== missing
    if (!ok) found.add(emoji)
    return ok
  }

  // Save the result once the caller has checked everything.
  queueMicrotask(() => {
    try { localStorage.setItem(cacheKey, JSON.stringify([...found])) } catch {}
  })
  return check
}

/**
 * Whether this system draws flag emoji. Windows does not: a flag shows as two letters, so
 * the pair is about twice as wide as one regional indicator. Flags are hidden there.
 */
function supportsFlagEmoji(): boolean {
  try {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return true
    context.font = "32px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
    const pair = context.measureText('\u{1F1EE}\u{1F1F7}').width
    const single = context.measureText('\u{1F1EE}').width
    return pair < single * 1.5
  } catch {
    return true
  }
}

export function loadEmojiGroups(): Promise<EmojiGroup[]> {
  loading ??= (async () => {
    const [{ default: data }, { default: fa }] = await Promise.all([
      import('emojibase-data/en/compact.json'),
      import('cldr-annotations-full/annotations/fa/annotations.json')
    ])
    const persian = (fa as any).annotations.annotations as Record<string, { default?: string[] }>
    const stripVs = (s: string) => s.replace(/️/g, '')

    const groups = new Map<EmojiGroupKey, Array<EmojiItem & { order: number }>>()
    for (const emoji of data as CompactEmoji[]) {
      const key = emoji.group != null ? GROUPS[emoji.group] : undefined
      if (!key) continue

      const fa = persian[emoji.unicode]?.default ?? persian[stripVs(emoji.unicode)]?.default ?? []
      const item = {
        unicode: emoji.unicode,
        label: emoji.label,
        keywords: [emoji.label, ...(emoji.tags ?? []), ...fa].join(' ').toLowerCase(),
        skins: emoji.skins?.length === 5 ? emoji.skins.map(skin => skin.unicode) : undefined,
        order: emoji.order ?? 0
      }
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }

    if (!supportsFlagEmoji()) groups.delete('flags')

    // Newer emoji the system font cannot draw would show as empty boxes: leave them out.
    const supported = createSupportCheck()
    for (const [key, items] of groups) {
      groups.set(key, items.filter(item => supported(item.unicode)))
    }

    return ORDER.filter(key => groups.has(key)).map(key => ({
      key,
      items: groups.get(key)!.sort((a, b) => a.order - b.order).map(({ order: _order, ...item }) => item)
    }))
  })()
  loading.catch(() => { loading = null })
  return loading
}

// ---------- per-device emoji preferences ----------

const RECENT_KEY = 'phi.emoji.recent'
const TONE_KEY = 'phi.emoji.tone'
const MAX_RECENT = 32

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function readTone(): number {
  try {
    const value = Number(localStorage.getItem(TONE_KEY))
    return Number.isInteger(value) && value >= 0 && value <= 5 ? value : 0
  } catch {
    return 0
  }
}

/** Recently used emoji (most recent first), shared by the composer and reactions. */
export const recentEmojis = ref<string[]>(readRecent())

/** 0 = default yellow, 1..5 = light..dark skin tone. */
export const skinTone = ref<number>(readTone())

export function rememberEmoji(emoji: string) {
  recentEmojis.value = [emoji, ...recentEmojis.value.filter(e => e !== emoji)].slice(0, MAX_RECENT)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentEmojis.value)) } catch {}
}

export function setSkinTone(tone: number) {
  skinTone.value = tone
  try { localStorage.setItem(TONE_KEY, String(tone)) } catch {}
}

/** The emoji in the chosen skin tone, if it has tones. */
export function withTone(item: EmojiItem, tone = skinTone.value): string {
  return tone > 0 && item.skins ? item.skins[tone - 1] : item.unicode
}
