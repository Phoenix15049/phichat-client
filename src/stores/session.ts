import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getMeProfile } from '../services/api'
import { getToken, parseJwt } from '../services/auth'
import type { UserApiItem } from '../types/chat'

const NAME_IDENTIFIER_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'

/**
 * The signed-in user. Shared by the chat page, side menu, profile and settings,
 * so a profile change shows up everywhere without a reload.
 */
export const useSessionStore = defineStore('session', () => {
  const userId = ref('')
  const me = ref<UserApiItem | null>(null)

  /** Reads the user id from the current access token. */
  function syncFromToken() {
    userId.value = String(parseJwt(getToken())?.[NAME_IDENTIFIER_CLAIM] ?? '')
    if (me.value && me.value.id !== userId.value) me.value = null
    return userId.value
  }

  async function loadMe() {
    me.value = await getMeProfile()
    return me.value
  }

  /** Applies a saved profile change locally. */
  function updateMe(patch: Partial<UserApiItem>) {
    if (me.value) me.value = { ...me.value, ...patch }
  }

  function reset() {
    userId.value = ''
    me.value = null
  }

  return { userId, me, syncFromToken, loadMe, updateMe, reset }
})
