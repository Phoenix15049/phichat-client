import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  // Backend used by the dev proxy. The ASP.NET dev certificate is self-signed, hence secure: false.
  const target = env.VITE_DEV_PROXY_TARGET || 'https://localhost:7146'

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true, secure: false },
        // The hub lives under /hubs so it never shadows the app's own /chat route.
        '/hubs': { target, changeOrigin: true, secure: false, ws: true },
        '/uploads': { target, changeOrigin: true, secure: false }
      }
    }
  }
})
