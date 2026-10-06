import { deletePushSubscription, getPushPublicKey, savePushSubscription } from './api'
import { notificationPermission } from './notifications'

export const pushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '='))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a || a.byteLength !== b.length) return false
  const view = new Uint8Array(a)
  return view.every((byte, i) => byte === b[i])
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported) return null
  // `ready` never settles when no worker is registered (e.g. registration failed).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => setTimeout(() => resolve(null), 5000))
  ])
}

export type PushPreferences = { enabled: boolean; showSender: boolean; lang: 'fa' | 'en' }

/**
 * Makes this browser's push subscription match the settings: subscribed (and registered with the
 * server) while notifications are on and allowed, unsubscribed otherwise.
 */
export async function syncPushSubscription(prefs: PushPreferences): Promise<void> {
  const registration = await readyRegistration()
  if (!registration) return

  let subscription = await registration.pushManager.getSubscription()

  if (!prefs.enabled || notificationPermission() !== 'granted') {
    if (subscription) {
      await deletePushSubscription(subscription.endpoint).catch(() => {})
      await subscription.unsubscribe().catch(() => false)
    }
    return
  }

  const serverKey = base64UrlToBytes(await getPushPublicKey())

  // A subscription made for another server key cannot receive our pushes.
  if (subscription && !sameBytes(subscription.options.applicationServerKey, serverKey)) {
    await subscription.unsubscribe().catch(() => false)
    subscription = null
  }

  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey as BufferSource
  })

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

  await savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    lang: prefs.lang,
    showSender: prefs.showSender
  })
}
