import { ref, type Ref } from 'vue'
import { editMessage, replaceMessageFile } from '../../../services/api'
import type { MessageEnvelope } from '../../../services/e2ee/messageCodec'
import type { UiMessage } from '../../../types/chat'
import { prepareAttachment, type SealAndSend } from '../attachments'
import type { useSecureFiles } from './useSecureFiles'

export type EditChange = {
  caption: string
  /** New files by message; the messages not listed keep theirs. */
  replacements: Array<{ message: UiMessage; file: File }>
  compress: boolean
}

type UseMessageEditorOptions = {
  selectedChatId: () => string | null
  messages: Ref<UiMessage[]>
  sealAndSend: SealAndSend
  secureFiles: Pick<ReturnType<typeof useSecureFiles>, 'adoptReplaced'>
  compressImage: (file: File) => Promise<File>
  toAbsoluteUrl: (url: string | null) => string | null
  describeError: (error: unknown) => string
  onSaved: () => void
}

/** Edits an attachment message: its caption and its file, or those of a whole album at once. */
export function useMessageEditor({
  selectedChatId,
  messages,
  sealAndSend,
  secureFiles,
  compressImage,
  toAbsoluteUrl,
  describeError,
  onSaved
}: UseMessageEditorOptions) {
  /** The items being edited: one message, or every item of its album in order. */
  const target = ref<UiMessage[] | null>(null)
  const saving = ref(false)
  const progress = ref<{ done: number; total: number } | null>(null)
  const error = ref<string | null>(null)

  function open(message: UiMessage) {
    const albumId = message.album?.id
    const items = albumId
      ? messages.value
        .filter(item => item.album?.id === albumId && item.senderId === message.senderId && item.id)
        .sort((a, b) => (a.album?.index ?? 0) - (b.album?.index ?? 0))
      : [message]

    target.value = items
    error.value = null
  }

  function close() {
    if (saving.value) return
    target.value = null
    progress.value = null
    error.value = null
  }

  const envelopeOf = (message: UiMessage, text: string, file = message.file!): MessageEnvelope => ({
    text,
    file,
    ...(message.album ? { album: message.album } : {}),
    ...(message.preview ? { preview: message.preview } : {})
  })

  async function replaceFile(chatId: string, message: UiMessage, original: File, text: string, compress: boolean) {
    let file = original
    if (compress && file.type.startsWith('image/')) {
      try {
        file = await compressImage(file)
      } catch {}
    }

    const attachment = await prepareAttachment(file)
    let saved: Awaited<ReturnType<typeof replaceMessageFile>> | null = null

    await sealAndSend(chatId, envelopeOf(message, text, attachment.meta), async body => {
      saved = await replaceMessageFile(message.id!, body, attachment.blob)
    })

    const result = saved as Awaited<ReturnType<typeof replaceMessageFile>> | null
    const url = toAbsoluteUrl(result?.fileUrl ?? null)
    if (url) {
      secureFiles.adoptReplaced(message, file, attachment.meta, url)
      message.fileUrl = url
    }
    message.file = attachment.meta
    message.plainText = text
    message.updatedAtUtc = result?.updatedAtUtc ?? new Date().toISOString()
  }

  async function changeCaption(chatId: string, message: UiMessage, text: string) {
    await sealAndSend(chatId, envelopeOf(message, text), body => editMessage(message.id!, body))
    message.plainText = text
    message.updatedAtUtc = new Date().toISOString()
  }

  async function save(change: EditChange) {
    const chatId = selectedChatId()
    const items = target.value
    if (!chatId || !items?.length || saving.value) return

    const caption = change.caption.trim()
    // An album's caption is sent with one of its items.
    const holder = items.find(item => item.plainText) ?? items[0]
    const replacing = new Map(change.replacements.map(entry => [entry.message, entry.file]))
    const captionChanged = (holder.plainText || '') !== caption

    const steps: Array<() => Promise<void>> = []
    for (const [message, file] of replacing) {
      const text = message === holder ? caption : message.plainText
      steps.push(() => replaceFile(chatId, message, file, text, change.compress))
    }
    if (captionChanged && !replacing.has(holder)) steps.push(() => changeCaption(chatId, holder, caption))

    saving.value = true
    error.value = null
    progress.value = { done: 0, total: steps.length }

    try {
      for (const step of steps) {
        await step()
        progress.value = { done: progress.value.done + 1, total: steps.length }
      }
    } catch (failure) {
      // What was saved stays saved; the editor stays open with the rest.
      console.warn('edit failed', failure)
      error.value = describeError(failure)
      saving.value = false
      return
    }

    saving.value = false
    close()
    onSaved()
  }

  return { target, saving, progress, error, open, close, save }
}
