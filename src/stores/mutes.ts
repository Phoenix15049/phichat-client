import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { getMutedChats, muteChat, unmuteChat } from '../services/api'

/** Muted chats, shared by the user's devices (kept in sync through the hub). */
export const useMutesStore = defineStore('mutes', () => {
  const ids = reactive(new Set<string>())
  const loaded = ref(false)

  async function load() {
    try {
      const list = await getMutedChats()
      ids.clear()
      list.forEach(id => ids.add(id))
      loaded.value = true
    } catch {}
  }

  function isMuted(chatId?: string | null) {
    return !!chatId && ids.has(chatId)
  }

  /** Applies a change made here or on another device. */
  function apply(chatId: string, muted: boolean) {
    if (muted) ids.add(chatId)
    else ids.delete(chatId)
  }

  async function toggle(chatId: string) {
    const muted = !ids.has(chatId)
    apply(chatId, muted)
    try {
      if (muted) await muteChat(chatId)
      else await unmuteChat(chatId)
    } catch (err) {
      apply(chatId, !muted)
      throw err
    }
  }

  function reset() {
    ids.clear()
    loaded.value = false
  }

  return { ids, loaded, load, isMuted, apply, toggle, reset }
})
