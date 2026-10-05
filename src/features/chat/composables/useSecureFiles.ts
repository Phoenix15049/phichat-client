import { reactive } from 'vue'
import type { FileMeta } from '../../../services/e2ee/messageCodec'
import { openFile } from '../../../services/e2ee/primitives'
import type { UiMessage } from '../../../types/chat'

type Entry = { status: 'loading' | 'ready' | 'error'; url: string }

/** Decrypted attachments as object URLs, keyed by server URL (or `local:{clientId}` while sending). */
const entries = reactive(new Map<string, Entry>())
const loads = new Map<string, Promise<Blob>>()
const blobs = new Map<string, Blob>()

export type FileKind = 'image' | 'video' | 'file'

/**
 * Object URLs share the app's origin, so a sender-chosen type such as text/html or SVG could
 * run script if opened in a tab. Only inert media types are kept; everything else is binary.
 */
function safeMime(mime: string): string {
  const value = mime.toLowerCase().trim()
  if (/^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/(mp4|webm|ogg|quicktime)|audio\/[a-z0-9.+-]+)$/.test(value)) return value
  return 'application/octet-stream'
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)$/i
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i

export function fileKindOf(message: Pick<UiMessage, 'file' | 'fileUrl'>): FileKind {
  if (message.file) {
    const mime = safeMime(message.file.mime)
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    return 'file'
  }

  // Attachments from before end-to-end encryption are plain files: go by extension.
  const path = (message.fileUrl || '').split('?')[0]
  if (IMAGE_EXT.test(path)) return 'image'
  if (VIDEO_EXT.test(path)) return 'video'
  return 'file'
}

function entryFor(message: Pick<UiMessage, 'fileUrl' | 'clientId'>): Entry | undefined {
  return (message.fileUrl && entries.get(message.fileUrl)) || (message.clientId ? entries.get(`local:${message.clientId}`) : undefined)
}

async function fetchAndOpen(fileUrl: string, meta: FileMeta): Promise<Blob> {
  const response = await fetch(fileUrl, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`download failed: ${response.status}`)
  const plain = await openFile(await response.arrayBuffer(), meta.key, meta.iv)
  return new Blob([plain], { type: safeMime(meta.mime) })
}

export function useSecureFiles() {
  /** URL to display the attachment, or null while it is still being decrypted. */
  function mediaSrc(message: UiMessage): string | null {
    if (!message.file) {
      return message.fileUrl && message.fileUrl !== '(pending)' ? message.fileUrl : null
    }
    const entry = entryFor(message)
    return entry?.status === 'ready' ? entry.url : null
  }

  function mediaState(message: UiMessage): Entry['status'] | 'idle' {
    if (!message.file) return 'ready'
    return entryFor(message)?.status ?? 'idle'
  }

  /** Decrypted content of an attachment (downloads and decrypts once). */
  function blobFor(message: UiMessage): Promise<Blob> {
    const url = message.fileUrl
    const meta = message.file
    const local = message.clientId ? blobs.get(`local:${message.clientId}`) : undefined
    if (local) return Promise.resolve(local)
    if (!url || url === '(pending)' || !meta) return Promise.reject(new Error('no encrypted attachment'))

    const cached = blobs.get(url)
    if (cached) return Promise.resolve(cached)

    let load = loads.get(url)
    if (!load) {
      load = fetchAndOpen(url, meta).then(blob => {
        blobs.set(url, blob)
        return blob
      }).finally(() => loads.delete(url))
      loads.set(url, load)
    }
    return load
  }

  /** Starts decrypting an image or video so it can be shown. */
  function ensureMedia(message: UiMessage) {
    const url = message.fileUrl
    if (!message.file || !url || url === '(pending)' || entryFor(message)) return
    if (fileKindOf(message) === 'file') return

    entries.set(url, { status: 'loading', url: '' })
    blobFor(message).then(
      blob => entries.set(url, { status: 'ready', url: URL.createObjectURL(blob) }),
      error => {
        console.warn('attachment decrypt failed', error)
        entries.set(url, { status: 'error', url: '' })
      }
    )
  }

  /** Shows a file being sent from its local copy, and keeps using it once it has a server URL. */
  function registerLocal(clientId: string, file: Blob, meta: FileMeta) {
    const blob = new Blob([file], { type: safeMime(meta.mime) })
    blobs.set(`local:${clientId}`, blob)
    entries.set(`local:${clientId}`, { status: 'ready', url: URL.createObjectURL(blob) })
  }

  /** Called when the server confirms a sent attachment: the server URL reuses the local copy. */
  function adoptServerUrl(clientId: string, fileUrl: string) {
    const entry = entries.get(`local:${clientId}`)
    const blob = blobs.get(`local:${clientId}`)
    if (entry && !entries.has(fileUrl)) entries.set(fileUrl, entry)
    if (blob && !blobs.has(fileUrl)) blobs.set(fileUrl, blob)
  }

  /** Saves a decrypted attachment under its original name. */
  async function downloadDecrypted(message: UiMessage) {
    const blob = await blobFor(message)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = message.file?.name || 'file'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  /** Frees every decrypted copy (leaving the chat page or signing out). */
  function releaseAll() {
    const urls = new Set([...entries.values()].map(entry => entry.url).filter(Boolean))
    for (const url of urls) URL.revokeObjectURL(url)
    entries.clear()
    blobs.clear()
    loads.clear()
  }

  return {
    mediaSrc,
    mediaState,
    ensureMedia,
    blobFor,
    registerLocal,
    adoptServerUrl,
    downloadDecrypted,
    releaseAll
  }
}
