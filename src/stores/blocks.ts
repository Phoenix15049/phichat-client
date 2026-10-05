import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { blockUser, getBlockedUsers, unblockUser, type BlockedUser } from '../services/api'

/** Users the signed-in user has blocked (kept in sync across devices by BlockListChanged). */
export const useBlocksStore = defineStore('blocks', () => {
  const list = ref<BlockedUser[]>([])
  const loaded = ref(false)
  const ids = computed(() => new Set(list.value.map(user => user.userId)))

  async function load() {
    try {
      list.value = await getBlockedUsers()
      loaded.value = true
    } catch (error) {
      console.warn('load blocked users failed', error)
    }
  }

  const isBlocked = (userId: string | null | undefined) => !!userId && ids.value.has(userId)

  async function block(userId: string) {
    await blockUser(userId)
    await load()
  }

  async function unblock(userId: string) {
    await unblockUser(userId)
    list.value = list.value.filter(user => user.userId !== userId)
  }

  function reset() {
    list.value = []
    loaded.value = false
  }

  return { list, loaded, isBlocked, load, block, unblock, reset }
})
