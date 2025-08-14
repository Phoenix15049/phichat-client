
function normalizeIsoUtc(s?: string | null): string | null {
  if (!s) return null
  // has Z or explicit offset? leave as-is
  if (/Z$|[+\-]\d{2}:\d{2}$/.test(s)) return s
  // fallback: assume UTC and append Z
  return s + 'Z'
}

export function toDateSafe(iso?: string | null): Date | null {
  const n = normalizeIsoUtc(iso)
  if (!n) return null
  const d = new Date(n)
  return isNaN(d.getTime()) ? null : d
}

export function formatAbsoluteFa(iso?: string | null): string {
  const d = toDateSafe(iso)
  if (!d) return 'نامشخص'
  // Localize to user's system locale/timezone (fa-IR here)
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}

export function formatRelativeFa(iso?: string | null): string {
  const d = toDateSafe(iso)
  if (!d) return 'نامشخص'

  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr  = Math.round(min / 60)
  const day = Math.round(hr / 24)

  // Very fresh
  if (sec < 60) return 'هم‌اکنون'

  // Prefer Intl.RelativeTimeFormat when available
  try {
    const rtf = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' })
    if (min < 60) return rtf.format(-min, 'minute')   // e.g., ۳ دقیقه پیش
    if (hr  < 24) return rtf.format(-hr,  'hour')     // e.g., ۲ ساعت پیش
    if (day < 30) return rtf.format(-day, 'day')      // e.g., ۵ روز پیش
  } catch {
    // fallback manual strings
    if (min < 60) return `${min} دقیقه پیش`
    if (hr  < 24) return `${hr} ساعت پیش`
    if (day < 30) return `${day} روز پیش`
  }

  // Older than ~1 ماه: show absolute local
  return formatAbsoluteFa(iso)
}
