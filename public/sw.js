// PhiChat service worker: an offline app shell and push notifications.
// Push messages never contain message text: the server cannot read it (end-to-end encryption).

const SHELL_CACHE = 'phichat-shell-v1'

const TEXT = {
  fa: { app: 'فی‌چت', newMessage: 'پیام جدید' },
  en: { app: 'PhiChat', newMessage: 'New message' }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL_CACHE) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only the app itself is cached; the API, uploads and other origins always go to the network.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Network first, so a new version shows up at once; the cached page only when offline.
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
          const cache = await caches.open(SHELL_CACHE)
          await cache.put('/index.html', response.clone())
        }
        return response
      } catch (err) {
        const cached = await caches.match('/index.html')
        if (cached) return cached
        throw err
      }
    })())
    return
  }

  // Built files have content hashes in their names, so a cached copy never goes stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE)
        await cache.put(request, response.clone())
      }
      return response
    })())
  }
})

/** Only paths of this app may be opened from a notification. */
function safeAppPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/chat'
}

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {}

  const text = TEXT[data.lang] || TEXT.fa
  const title = typeof data.name === 'string' && data.name ? data.name : text.app
  // In a group the title is the group and the body says who wrote.
  const body = typeof data.from === 'string' && data.from ? `${data.from}: ${text.newMessage}` : text.newMessage

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    // A new message in the same chat alerts again instead of silently replacing the old notification.
    renotify: typeof data.tag === 'string',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    lang: data.lang === 'en' ? 'en' : 'fa',
    dir: data.lang === 'en' ? 'ltr' : 'rtl',
    data: { url: safeAppPath(data.url) }
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = safeAppPath(event.notification.data && event.notification.data.url)

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (open) {
      await open.focus()
      open.postMessage({ type: 'navigate', url })
      return
    }
    await self.clients.openWindow(url)
  })())
})
