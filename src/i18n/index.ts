import { createI18n } from 'vue-i18n'
import en from './locales/en'
import fa from './locales/fa'

export type AppLocale = 'fa' | 'en'

export const SUPPORTED_LOCALES: AppLocale[] = ['fa', 'en']
const DEFAULT_LOCALE: AppLocale = 'fa'
const STORAGE_KEY = 'phi.locale'

const RTL_LOCALES: AppLocale[] = ['fa']

/** BCP 47 tags for Intl date / number formatting. */
const INTL_LOCALE: Record<AppLocale, string> = {
  fa: 'fa-IR',
  en: 'en-US'
}

function storedLocale(): AppLocale {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LOCALES.includes(value as AppLocale) ? (value as AppLocale) : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: storedLocale(),
  fallbackLocale: 'en',
  messages: { fa, en }
})

export function currentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale
}

export function isRtl(locale: AppLocale = currentLocale()) {
  return RTL_LOCALES.includes(locale)
}

export function intlLocale(locale: AppLocale = currentLocale()) {
  return INTL_LOCALE[locale]
}

/** Keeps <html lang dir> in sync so the whole layout mirrors for RTL languages. */
function applyDocumentDirection(locale: AppLocale) {
  document.documentElement.lang = locale
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
}

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  try { localStorage.setItem(STORAGE_KEY, locale) } catch {}
  applyDocumentDirection(locale)
}

applyDocumentDirection(currentLocale())

/** Translation function for code outside components (composables, services). */
export const t = i18n.global.t
