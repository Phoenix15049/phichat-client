import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { getGroup, type GroupDetails, type GroupMemberItem } from '../services/api'
import { clearGroupChats, forgetGroupChat, markGroupChat } from '../services/chatKinds'

/** Details (name, photo, members and roles) of the groups the user belongs to. */
export const useGroupsStore = defineStore('groups', () => {
  const details = reactive<Record<string, GroupDetails>>({})
  /** Everyone seen in any group, so service messages can still name people who left. */
  const knownUsers = reactive<Record<string, GroupMemberItem>>({})

  function remember(group: GroupDetails) {
    for (const m of group.members) knownUsers[m.userId] = m
  }
  const requests = new Map<string, Promise<GroupDetails | null>>()

  /** Loads (or with `force` reloads) a group; null when it is gone or we are not a member. */
  function load(groupId: string, force = false): Promise<GroupDetails | null> {
    markGroupChat(groupId)
    if (details[groupId] && !force) return Promise.resolve(details[groupId])

    const pending = requests.get(groupId)
    if (pending && !force) return pending

    const request = (async () => {
      try {
        const group = await getGroup(groupId)
        remember(group)
        details[groupId] = group
        return group
      } catch {
        return null
      } finally {
        requests.delete(groupId)
      }
    })()
    requests.set(groupId, request)
    return request
  }

  function set(group: GroupDetails) {
    remember(group)
    markGroupChat(group.id)
    details[group.id] = group
  }

  function member(groupId: string | null | undefined, userId: string): GroupMemberItem | null {
    if (!groupId) return null
    return details[groupId]?.members.find(m => m.userId === userId) ?? null
  }

  function known(userId: string): GroupMemberItem | null {
    return knownUsers[userId] ?? null
  }

  function canManage(groupId: string | null | undefined): boolean {
    const role = groupId ? details[groupId]?.myRole : null
    return role === 'owner' || role === 'admin'
  }

  function forget(groupId: string) {
    delete details[groupId]
    forgetGroupChat(groupId)
  }

  function reset() {
    for (const id of Object.keys(details)) delete details[id]
    for (const id of Object.keys(knownUsers)) delete knownUsers[id]
    requests.clear()
    clearGroupChats()
  }

  return { details, load, set, member, known, canManage, forget, reset }
})
