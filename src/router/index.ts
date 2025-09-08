import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import ContactsView from '../views/ContactsView.vue'
import ConversationsView from '../views/ConversationsView.vue'
import { getToken, isJwtExpired } from '../services/auth'

const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/register', component: RegisterView, meta: { public: true } },
  { path: '/chat', component: ChatView },
  { path: '/settings', component: SettingsView },
  { path: '/contacts', component: ContactsView },
  { path: '/u/:username', component: ChatView, props: true },
  { path: '/conversations', component: ConversationsView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const token = getToken()
  const authed = !!token && !isJwtExpired(token)

  if (to.meta?.public) {
    if (authed) return '/chat'
    return true
  }

  if (!authed) return '/login'
  return true
})

export default router
