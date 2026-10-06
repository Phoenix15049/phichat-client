// New-message notifications while the app is open (the service worker shows them when it is closed).

export const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

let audio: AudioContext | null = null

/** A short two-note chime, synthesized so no sound file is needed. */
export function playNotificationSound() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audio ??= new Ctor()
    // Browsers keep audio suspended until the user has interacted with the page.
    if (audio.state === 'suspended') void audio.resume().catch(() => {})

    const start = audio.currentTime
    for (const [i, frequency] of [880, 1320].entries()) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const at = start + i * 0.12
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      osc.connect(gain).connect(audio.destination)
      osc.start(at)
      osc.stop(at + 0.25)
    }
  } catch {}
}

export type MessageNotification = {
  title: string
  body: string
  /** Notifications with the same tag replace each other (one per chat). */
  tag: string
  /** App route opened on click, e.g. /u/ali. */
  url: string
}

/** Shows a system notification (through the service worker when there is one, so it works on phones too). */
export async function showMessageNotification(notification: MessageNotification) {
  if (notificationPermission() !== 'granted') return

  const options: NotificationOptions = {
    body: notification.body,
    tag: notification.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    // The app plays its own sound (and respects the sound setting).
    silent: true,
    data: { url: notification.url }
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(notification.title, options)
      return
    }
  } catch {}

  try {
    const shown = new Notification(notification.title, options)
    shown.onclick = () => {
      window.focus()
      window.dispatchEvent(new CustomEvent('phi:navigate', { detail: notification.url }))
      shown.close()
    }
  } catch {}
}

/** Removes the chat's notifications once it is read here. */
export async function clearChatNotifications(tag: string) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    const shown = await registration?.getNotifications({ tag })
    shown?.forEach(n => n.close())
  } catch {}
}
