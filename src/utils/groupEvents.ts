import { i18n, t } from '../i18n'

/** A group service message, as written by the server (JSON). */
export type GroupSystemEvent = {
  type: 'created' | 'added' | 'removed' | 'left' | 'title' | 'photo' | 'photoRemoved' | string
  title?: string
  users?: string[]
}

export function parseSystemEvent(json: string | null | undefined): GroupSystemEvent | null {
  if (!json) return null
  try {
    const value = JSON.parse(json)
    if (!value || typeof value.type !== 'string') return null
    return {
      type: value.type,
      title: typeof value.title === 'string' ? value.title : undefined,
      users: Array.isArray(value.users) ? value.users.map(String) : undefined
    }
  } catch {
    return null
  }
}

function joinNames(names: string[]): string {
  try {
    const ListFormat = (Intl as any).ListFormat
    if (ListFormat) return new ListFormat(String(i18n.global.locale.value), { type: 'conjunction' }).format(names)
  } catch {}
  return names.join('، ')
}

/**
 * "Ali added Sara", "You left the group", ...; `nameOf` resolves user ids (and returns
 * "you" for the signed-in user).
 */
export function describeSystemEvent(json: string | null | undefined, actorId: string, nameOf: (userId: string) => string): string {
  const event = parseSystemEvent(json)
  if (!event) return ''

  const name = nameOf(actorId)
  const users = joinNames((event.users ?? []).map(nameOf))

  switch (event.type) {
    case 'created': return t('groups.event.created', { name, title: event.title ?? '' })
    case 'added': return t('groups.event.added', { name, users })
    case 'removed': return t('groups.event.removed', { name, users })
    case 'left': return t('groups.event.left', { name })
    case 'title': return t('groups.event.title', { name, title: event.title ?? '' })
    case 'photo': return t('groups.event.photo', { name })
    case 'photoRemoved': return t('groups.event.photoRemoved', { name })
    default: return t('groups.event.unknown')
  }
}
