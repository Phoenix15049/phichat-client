
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

export function formatAbsoluteFa(iso?: string | null): string {
  const d = toDateSafe(iso)
  if (!d) return 'نامشخص'
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

  if (sec < 60) return 'هم‌اکنون'

  try {
    const rtf = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' })
    if (min < 60) return rtf.format(-min, 'minute')   // e.g., ۳ دقیقه پیش
    if (hr  < 24) return rtf.format(-hr,  'hour')     // e.g., ۲ ساعت پیش
    if (day < 30) return rtf.format(-day, 'day')      // e.g., ۵ روز پیش
  } catch {
    if (min < 60) return `${min} دقیقه پیش`
    if (hr  < 24) return `${hr} ساعت پیش`
    if (day < 30) return `${day} روز پیش`
  }
  return formatAbsoluteFa(iso)
}

export function formatAbsoluteEn(iso?: string | null): string {
  const d = toDateSafe(iso); if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium', timeStyle: 'short'
  }).format(d);
}

export function formatRelativeEn(iso?: string | null): string {
  const d = toDateSafe(iso); if (!d) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
}