import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type TextSize = 'small' | 'medium' | 'large'

type Preferences = {
  theme: ThemePreference
  textSize: TextSize
  /** Enter sends (Shift+Enter for a new line); otherwise Ctrl/Cmd+Enter sends. */
  sendWithEnter: boolean
  /** Message bubble corner radius in px (like Telegram's "message corners"). */
  bubbleRadius: number
  /** A thin outline around message bubbles. */
  bubbleBorder: boolean
  /** Fetch a preview (via the server) for links in messages you write. */
  linkPreviews: boolean
  /** Notify about new messages on this device (needs the browser's permission). */
  notifications: boolean
  notificationSound: boolean
  /** Show the sender and message text in notifications; otherwise only "New message". */
  notificationPreview: boolean
}

/** Read by the inline script in index.html too, so the theme applies before the app loads. */
export const PREFERENCES_KEY = 'phi.prefs'

export const BUBBLE_RADIUS_MIN = 4
export const BUBBLE_RADIUS_MAX = 24

const DEFAULTS: Preferences = {
  theme: 'system',
  textSize: 'medium',
  sendWithEnter: true,
  bubbleRadius: 16,
  bubbleBorder: false,
  linkPreviews: true,
  notifications: true,
  notificationSound: true,
  notificationPreview: true
}

const BOOLEAN_KEYS = ['sendWithEnter', 'bubbleBorder', 'linkPreviews', 'notifications', 'notificationSound', 'notificationPreview'] as const
const TEXT_SIZES: Record<TextSize, string> = { small: '14px', medium: '15px', large: '17px' }

function load(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')
    const radius = Number(stored.bubbleRadius)
    const loaded: Preferences = {
      ...DEFAULTS,
      theme: ['system', 'light', 'dark'].includes(stored.theme) ? stored.theme : DEFAULTS.theme,
      textSize: stored.textSize in TEXT_SIZES ? stored.textSize : DEFAULTS.textSize,
      bubbleRadius: Number.isFinite(radius)
        ? Math.min(BUBBLE_RADIUS_MAX, Math.max(BUBBLE_RADIUS_MIN, Math.round(radius)))
        : DEFAULTS.bubbleRadius
    }
    for (const key of BOOLEAN_KEYS) {
      if (typeof stored[key] === 'boolean') loaded[key] = stored[key]
    }
    return loaded
  } catch {
    return { ...DEFAULTS }
  }
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** Per-device appearance and behaviour settings (not synced to the account). */
export const usePreferencesStore = defineStore('preferences', () => {
  const prefs = reactive<Preferences>(load())
  const systemDark = ref(!!media?.matches)
  media?.addEventListener('change', event => { systemDark.value = event.matches })

  /** The theme actually shown (resolves "system"). */
  const isDark = computed(() => prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark.value))

  function apply() {
    const root = document.documentElement
    root.classList.toggle('dark', isDark.value)
    root.style.setProperty('--chat-font-size', TEXT_SIZES[prefs.textSize])
    root.style.setProperty('--bubble-radius', `${prefs.bubbleRadius}px`)
    // The "tail" corner stays small, proportional to the chosen radius.
    root.style.setProperty('--bubble-tail-radius', `${Math.max(3, Math.round(prefs.bubbleRadius / 3))}px`)
    root.style.setProperty('--bubble-border', prefs.bubbleBorder ? '1px' : '0px')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark.value ? '#17212b' : '#ffffff')
  }

  watch(prefs, () => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs)) } catch {}
  }, { deep: true })

  // Synchronous so the class changes in the same tick as the setting.
  watch([() => ({ ...prefs }), isDark], apply, { flush: 'sync' })
  apply()

  /** Switches to the opposite of what is shown now (leaving "follow system"). */
  function toggleDark() {
    prefs.theme = isDark.value ? 'light' : 'dark'
  }

  return { prefs, isDark, toggleDark }
})
