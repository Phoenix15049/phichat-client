import { computed, ref, shallowRef } from 'vue'
import { getConversationPaged } from '../../../services/api'
import type { OpenedMessage } from '../../../stores/e2ee'
import type { ServerMessage, UiMessage } from '../../../types/chat'
import { mapServerMessage } from '../../../utils/messageMapper'
import { fileKindOf } from './useSecureFiles'

export type SharedKind = 'photos' | 'videos' | 'files' | 'music' | 'voice' | 'links'

export type SharedLink = { url: string; host: string; title: string; message: UiMessage }

/** Where messages of Saved Messages came from; a null sender is what the user wrote there. */
export type SavedSource = { senderId: string | null; messages: UiMessage[] }

/** The most messages looked through; a page holds 100. */
const MAX_PAGES = 300
const PAGE_SIZE = 100
const LINK = /https?:\/\/[^\s<>"'`]+/g

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function linksOf(message: UiMessage): SharedLink[] {
  const urls = new Set<string>()
  if (message.preview?.url) urls.add(message.preview.url)
  for (const match of message.plainText.match(LINK) ?? []) urls.add(match.replace(/[.,;:!?)\]}»"']+$/, ''))

  return [...urls].map(url => ({
    url,
    host: hostOf(url),
    title: (message.preview?.url === url && message.preview.title) || hostOf(url),
    message
  }))
}

type UseChatIndexOptions = {
  myId: () => string
  open: (raw: string, senderId: string, chatId: string) => Promise<OpenedMessage>
}

/**
 * What a chat has shared. Only the sender and the recipients can read a message, so the server
 * cannot tell a photo from a link: the chat's history is read and sorted here, a page at a time,
 * and the counts grow as it goes. Kept per chat until the page is left, and refreshed on each look.
 */
export function useChatIndex({ myId, open }: UseChatIndexOptions) {
  const known = new Map<string, UiMessage[]>()

  /** Newest first. */
  const items = shallowRef<UiMessage[]>([])
  const scanning = ref(false)
  const chatId = ref<string | null>(null)
  let run = 0

  async function mapPage(source: ServerMessage[], id: string) {
    const visible = source.filter(message => !(message.isDeleted ?? message.IsDeleted) && !(message.systemEvent ?? message.SystemEvent))
    const mapped = await Promise.all(visible.map(message => mapServerMessage(message, {
      myId: myId(),
      open: (raw, senderId) => open(raw, senderId, id)
    })))
    return mapped.filter(message => message.cipher !== 'old-key' && message.cipher !== 'failed').reverse()
  }

  async function start(id: string) {
    const mine = ++run
    const cached = known.get(id)

    chatId.value = id
    items.value = cached ?? []
    scanning.value = true

    const found: UiMessage[] = []
    let before: string | undefined

    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await getConversationPaged(id, before, PAGE_SIZE)
        const mapped = await mapPage(result.items, id)
        if (mine !== run) return

        found.push(...mapped)
        // A look at a known chat keeps what it had until it has seen more than that.
        if (!cached || found.length > cached.length) items.value = [...found]

        if (!result.hasMore || !result.oldestId) break
        before = result.oldestId
      }

      items.value = found
      known.set(id, found)
    } catch (error) {
      console.warn('reading the chat history failed', error)
    } finally {
      if (mine === run) scanning.value = false
    }
  }

  function stop() {
    run++
    scanning.value = false
  }

  /** A message was deleted while the panel is open. */
  function forget(messageId: string) {
    items.value = items.value.filter(item => item.id !== messageId)
    for (const [id, list] of known) known.set(id, list.filter(item => item.id !== messageId))
  }

  /** Saved copies of decrypted history go with the page. */
  function reset() {
    stop()
    known.clear()
    items.value = []
    chatId.value = null
  }

  const shared = computed(() => {
    const result = { photos: [] as UiMessage[], videos: [] as UiMessage[], files: [] as UiMessage[], music: [] as UiMessage[], voice: [] as UiMessage[], links: [] as SharedLink[] }

    for (const message of items.value) {
      if (message.fileUrl) {
        const kind = fileKindOf(message)
        if (kind === 'image') result.photos.push(message)
        else if (kind === 'video') result.videos.push(message)
        else if (kind === 'voice') result.voice.push(message)
        else if (kind === 'audio') result.music.push(message)
        else result.files.push(message)
      }
      if (message.plainText) result.links.push(...linksOf(message))
    }

    return result
  })

  /** Photos and videos together, newest first. */
  const media = computed(() => items.value.filter(message => {
    if (!message.fileUrl) return false
    const kind = fileKindOf(message)
    return kind === 'image' || kind === 'video'
  }))

  /** Saved Messages: the people things were saved from, the most used first. */
  const sources = computed<SavedSource[]>(() => {
    const groups = new Map<string | null, UiMessage[]>()
    for (const message of items.value) {
      const key = message.forwardedFromSenderId ?? null
      const list = groups.get(key)
      if (list) list.push(message)
      else groups.set(key, [message])
    }
    return [...groups].map(([senderId, messages]) => ({ senderId, messages })).sort((a, b) => b.messages.length - a.messages.length)
  })

  const total = computed(() => items.value.length)

  return { chatId, items, scanning, shared, media, sources, total, start, stop, forget, reset }
}

export type ChatIndex = ReturnType<typeof useChatIndex>
