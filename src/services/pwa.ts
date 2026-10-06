import { ref } from 'vue'
import router from '../router'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let installEvent: InstallPromptEvent | null = null

/** True while the browser offers to install the app (Chrome, Edge, Android). */
export const canInstall = ref(false)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export async function promptInstall() {
  const event = installEvent
  if (!event) return
  installEvent = null
  canInstall.value = false
  await event.prompt()
  await event.userChoice.catch(() => null)
}

/** Registers the service worker and routes notification clicks into the app. */
export function setupPwa() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    installEvent = event as InstallPromptEvent
    canInstall.value = true
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    canInstall.value = false
  })

  const navigate = (url: unknown) => {
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) void router.push(url)
  }
  window.addEventListener('phi:navigate', event => navigate((event as CustomEvent).detail))

  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'navigate') navigate(event.data.url)
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('service worker registration failed', err))
  })
}
