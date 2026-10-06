/**
 * Which chat ids are groups. A chat is addressed by one id everywhere: the other user's id for a
 * private chat, the group id for a group (ids never collide). Services use this to pick the
 * group endpoints and encryption without every caller having to pass the chat type along.
 */
const groupIds = new Set<string>()

export function markGroupChat(id: string) {
  if (id) groupIds.add(id)
}

export function forgetGroupChat(id: string) {
  groupIds.delete(id)
}

export function isGroupChat(id: string | null | undefined): boolean {
  return !!id && groupIds.has(id)
}

export function clearGroupChats() {
  groupIds.clear()
}
