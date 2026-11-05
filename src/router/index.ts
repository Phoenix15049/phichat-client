import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import ContactsView from '../views/ContactsView.vue'
import { getToken, isJwtExpired } from '../services/auth'
import { getValidAccessToken, onSessionExpired, refreshAccessToken } from '../services/api'

const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/register', component: RegisterView, meta: { public: true } },
  { path: '/chat', component: ChatView },
  { path: '/settings', component: SettingsView },
  { path: '/contacts', component: ContactsView },
  // ChatView reads the username from route.params itself.
  { path: '/u/:username', component: ChatView },
  { path: '/g/:groupId', component: ChatView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.meta?.public) {
    const token = getToken()
    if (!token) return true
    if (!isJwtExpired(token)) return '/chat'

    // The session may be fine and only the access token old; a rejected refresh clears it.
    try {
      return (await refreshAccessToken()) ? '/chat' : true
    } catch {
      return true
    }
  }

  // Null means the session is over. A token that is still expired here means the server could not
  // be reached: the session is intact, so the app opens and catches up when the connection is back.
  return (await getValidAccessToken()) ? true : '/login'
})

onSessionExpired(() => {
  if (!router.currentRoute.value.meta?.public) {
    void router.replace('/login')
  }
})

export default router
