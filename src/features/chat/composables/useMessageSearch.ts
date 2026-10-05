import { computed, ref, watch, type Ref } from 'vue'
import type { UiMessage } from '../../../types/chat'

type UseMessageSearchOptions = {
  messages: Ref<UiMessage[]>
  hasMore: Ref<boolean>
  loadOlderMessages: () => Promise<boolean>
  jumpTo: (messageId: string) => Promise<void>
}

/** Older pages loaded at most by "search older messages" (50 messages each). */
const MAX_PAGES = 60

/**
 * Lower-cases and unifies Persian/Arabic letter forms, and drops diacritics, tatweel and
 * zero-width joiners, so "كتاب" finds "کتاب" and "می‌روم" finds "میروم".
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ً-ٰٟـ‌‍]/g, '')
}

/**
 * Searching inside the open chat. Messages are end-to-end encrypted, so the server cannot
 * search: this looks through the decrypted messages loaded in the browser and can load older
 * pages on request.
 */
export function useMessageSearch({ messages, hasMore, loadOlderMessages, jumpTo }: UseMessageSearchOptions) {
  const open = ref(false)
  const query = ref('')
  const index = ref(0)
  const loadingOlder = ref(false)

  const searchable = (message: UiMessage) =>
    [message.plainText, message.file?.name, message.preview?.title].filter(Boolean).join(' ')

  /** Matching message ids, newest first. */
  const results = computed(() => {
    const terms = normalizeForSearch(query.value.trim()).split(/\s+/).filter(Boolean)
    if (!terms.length) return [] as string[]

    const found: string[] = []
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const message = messages.value[i]
      if (!message.id || message.isDeleted) continue
      const text = normalizeForSearch(searchable(message))
      if (text && terms.every(term => text.includes(term))) found.push(message.id)
    }
    return found
  })

  const current = computed(() => results.value[index.value] ?? null)

  watch(query, () => {
    index.value = 0
  })

  // Jump to the newest match as results appear.
  watch(() => results.value[0], first => {
    if (open.value && first && index.value === 0) void jumpTo(first)
  })

  function go(step: 1 | -1) {
    if (!results.value.length) return
    index.value = (index.value + step + results.value.length) % results.value.length
    if (current.value) void jumpTo(current.value)
  }

  /** Loads older history so the search covers it (end-to-end encrypted: done in the browser). */
  async function searchOlder() {
    if (loadingOlder.value) return
    loadingOlder.value = true
    try {
      for (let page = 0; page < MAX_PAGES && hasMore.value; page++) {
        if (!(await loadOlderMessages())) break
      }
    } finally {
      loadingOlder.value = false
    }
  }

  function show() {
    open.value = true
  }

  function close() {
    open.value = false
    query.value = ''
    index.value = 0
  }

  return { open, query, index, results, current, loadingOlder, go, searchOlder, show, close }
}
