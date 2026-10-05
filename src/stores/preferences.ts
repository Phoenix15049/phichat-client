import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type TextSize = 'small' | 'medium' | 'large'

type Preferences = {
  theme: ThemePreference
  textSize: TextSize
  /** Enter sends (Shift+Enter for a new line); otherwise Ctrl/Cmd+Enter sends. */
  sendWithEnter: boolean
}

/** Read by the inline script in index.html too, so the theme applies before the app loads. */
export const PREFERENCES_KEY = 'phi.prefs'

const DEFAULTS: Preferences = { theme: 'system', textSize: 'medium', sendWithEnter: true }
const TEXT_SIZES: Record<TextSize, string> = { small: '14px', medium: '15px', large: '17px' }

function load(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')
    return {
      theme: ['system', 'light', 'dark'].includes(stored.theme) ? stored.theme : DEFAULTS.theme,
      textSize: stored.textSize in TEXT_SIZES ? stored.textSize : DEFAULTS.textSize,
      sendWithEnter: typeof stored.sendWithEnter === 'boolean' ? stored.sendWithEnter : DEFAULTS.sendWithEnter
    }
  } catch {
    return { ...DEFAULTS }
  }
}

const systemDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** Per-device appearance and behaviour settings (not synced to the account). */
export const usePreferencesStore = defineStore('preferences', () => {
  const prefs = reactive<Preferences>(load())

  function apply() {
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && !!systemDark?.matches)
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.style.setProperty('--chat-font-size', TEXT_SIZES[prefs.textSize])
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17212b' : '#ffffff')
  }

  watch(prefs, () => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs)) } catch {}
    apply()
  }, { deep: true })

  systemDark?.addEventListener('change', () => { if (prefs.theme === 'system') apply() })
  apply()

  return { prefs }
})
