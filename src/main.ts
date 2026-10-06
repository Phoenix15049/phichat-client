import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { ripple } from './directives/ripple'
import { setupPwa } from './services/pwa'

import '@fontsource-variable/vazirmatn'
import "./assets/tailwind.css"


createApp(App).use(createPinia()).use(i18n).directive('ripple', ripple).use(router).mount('#app')
setupPwa()
