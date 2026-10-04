import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ripple } from './directives/ripple'

import "./assets/tailwind.css"


createApp(App).use(createPinia()).directive('ripple', ripple).use(router).mount('#app')
