/** Reactions offered on messages: a short list (like Telegram's), not the whole emoji set. */
export const MAX_REACTIONS = 32
/** Shown in the quick bar above a message. */
export const MAX_QUICK_REACTIONS = 6
export const MIN_QUICK_REACTIONS = 1

export const DEFAULT_REACTIONS = [
  '👍', '❤️', '🔥', '😂', '😢', '🙏', '👎', '🥰',
  '👏', '😁', '🤔', '🤯', '😱', '🎉', '🤩', '👌',
  '😍', '🤗', '💯', '⚡', '🏆', '😎', '🤝', '✍️',
  '😇', '🥳', '😡', '💔', '👀', '🙈', '😴', '🌹'
]

export const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😢', '🙏']

/** The server accepts reactions up to 16 UTF-16 units. */
const isReaction = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 16

/** A valid, de-duplicated reaction list from stored settings (defaults when unusable). */
export function sanitizeReactions(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_REACTIONS]
  const list = [...new Set(value.filter(isReaction))].slice(0, MAX_REACTIONS)
  return list.length >= MIN_QUICK_REACTIONS ? list : [...DEFAULT_REACTIONS]
}

/** Quick reactions must come from the list; falls back to its first ones. */
export function sanitizeQuickReactions(value: unknown, reactions: string[]): string[] {
  const chosen = Array.isArray(value)
    ? [...new Set(value.filter(isReaction))].filter(r => reactions.includes(r)).slice(0, MAX_QUICK_REACTIONS)
    : []
  if (chosen.length >= MIN_QUICK_REACTIONS) return chosen
  const defaults = DEFAULT_QUICK_REACTIONS.filter(r => reactions.includes(r))
  return defaults.length ? defaults : reactions.slice(0, MAX_QUICK_REACTIONS)
}
