import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ripple } from './directives/ripple'

import "./assets/tailwind.css"


createApp(App).directive('ripple', ripple).use(router).mount('#app')
