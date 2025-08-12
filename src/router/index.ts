import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import ContactsView from '../views/ContactsView.vue'
import ConversationsView from '../views/ConversationsView.vue'


const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
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

export default router
