import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import ContactsView from '../views/ContactsView.vue'
import { getToken, isJwtExpired } from '../services/auth'
import { getValidAccessToken, onSessionExpired } from '../services/api'

const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/register', component: RegisterView, meta: { public: true } },
  { path: '/chat', component: ChatView },
  { path: '/settings', component: SettingsView },
  { path: '/contacts', component: ContactsView },
  // ChatView reads the username from route.params itself.
  { path: '/u/:username', component: ChatView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.meta?.public) {
    const token = getToken()
    if (token && !isJwtExpired(token)) return '/chat'
    return true
  }

  // An expired access token is fine as long as the refresh cookie can renew it.
  const token = await getValidAccessToken()
  if (!token || isJwtExpired(token)) return '/login'
  return true
})

onSessionExpired(() => {
  if (!router.currentRoute.value.meta?.public) {
    void router.replace('/login')
  }
})

export default router
