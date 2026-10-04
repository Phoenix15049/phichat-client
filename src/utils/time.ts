import { intlLocale, t } from '../i18n'

/** Server timestamps are UTC but may lack a zone suffix. */
export function normalizeIsoUtc(s?: string | null): string | null {
  if (!s) return null
  if (/Z$|[+\-]\d{2}:\d{2}$/.test(s)) return s
  return s + 'Z'
}

export function toDateSafe(iso?: string | null): Date | null {
  const n = normalizeIsoUtc(iso)
  if (!n) return null
  const d = new Date(n)
  return isNaN(d.getTime()) ? null : d
}

/** Date and time in the UI language (Solar Hijri calendar and Persian digits for fa). */
export function formatAbsolute(iso?: string | null): string {
  const d = toDateSafe(iso)
  if (!d) return ''
  return new Intl.DateTimeFormat(intlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}

/** Clock time of a message, e.g. 14:05. */
export function formatTime(iso?: string | null): string {
  const d = toDateSafe(iso)
  if (!d) return ''
  return d.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })
}

/** "just now", "5 minutes ago", "yesterday"…, then a plain date after a week. */
export function formatRelative(iso?: string | null): string {
  const d = toDateSafe(iso)
  if (!d) return ''

  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return t('time.justNow')

  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' })
  if (mins < 60) return rtf.format(-mins, 'minute')

  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')

  const days = Math.round(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')

  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' }).format(d)
}

/** Day separator label in a chat: Today, Yesterday or the full date. */
export function formatDayLabel(iso?: string | null): string {
  const date = toDateSafe(iso)
  if (!date) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  const difference = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (difference === 0) return t('chat.today')
  if (difference === 1) return t('chat.yesterday')
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'full' }).format(date)
}
