import { ref, watch, type Ref } from 'vue'
import { fetchLinkPreview } from '../../../services/api'
import type { LinkPreviewMeta } from '../../../services/e2ee/messageCodec'
import { usePreferencesStore } from '../../../stores/preferences'

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i
const THUMBNAIL_SIZE = 320
const MAX_THUMBNAIL_CHARS = 90_000

/** The first link in a text, without trailing punctuation. */
export function firstUrl(text: string): string | null {
  const match = URL_PATTERN.exec(text)
  if (!match) return null
  return match[0].replace(/[.,;:!?)\]}»"']+$/, '')
}

/** Shrinks the preview image to a small JPEG data: URL so it fits inside the encrypted message. */
async function makeThumbnail(base64: string, type: string): Promise<string | undefined> {
  try {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type }))
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    for (const quality of [0.72, 0.55, 0.4]) {
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length <= MAX_THUMBNAIL_CHARS) return data
    }
  } catch {}
  return undefined
}

/**
 * Link preview for the message being written: waits until typing pauses, fetches the first
 * link's metadata through the server, and lets the user dismiss it.
 */
export function useLinkPreview(text: Ref<string>, enabled: Ref<boolean>) {
  const preferences = usePreferencesStore()
  const preview = ref<LinkPreviewMeta | null>(null)
  const loading = ref(false)
  const dismissedUrl = ref<string | null>(null)

  let timer: number | null = null
  let controller: AbortController | null = null
  let currentUrl: string | null = null

  function reset() {
    if (timer !== null) window.clearTimeout(timer)
    controller?.abort()
    timer = null
    controller = null
    currentUrl = null
    preview.value = null
    loading.value = false
  }

  async function load(url: string) {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    loading.value = true

    try {
      const result = await fetchLinkPreview(url, signal)
      if (signal.aborted || currentUrl !== url) return
      preview.value = result
        ? {
            url: result.url,
            siteName: result.siteName ?? undefined,
            title: result.title ?? undefined,
            description: result.description ?? undefined,
            image: result.imageBase64 && result.imageType ? await makeThumbnail(result.imageBase64, result.imageType) : undefined
          }
        : null
    } catch {
      if (!signal.aborted) preview.value = null
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  watch([text, enabled, () => preferences.prefs.linkPreviews], () => {
    const url = enabled.value && preferences.prefs.linkPreviews ? firstUrl(text.value) : null
    if (url === currentUrl) return

    reset()
    if (!url || url === dismissedUrl.value) return

    currentUrl = url
    timer = window.setTimeout(() => void load(url), 600)
  })

  /** Hides the preview for this link (until a different link is typed). */
  function dismiss() {
    dismissedUrl.value = currentUrl
    reset()
  }

  /** The preview to send with the current text (only if its link is still in the text). */
  function take(): LinkPreviewMeta | null {
    const result = preview.value && firstUrl(text.value) === currentUrl ? preview.value : null
    dismissedUrl.value = null
    reset()
    return result
  }

  return { preview, loading, dismiss, take, reset }
}
