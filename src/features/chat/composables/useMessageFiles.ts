import {
  reactive,
  ref,
  type Ref
} from 'vue'

import type {
  ChatUser,
  UiMessage
} from '../../../types/chat'
import type { FileMeta, VoiceMeta } from '../../../services/e2ee/messageCodec'
import type { Outbox } from './useOutbox'
import {
  prepareAttachment,
  sendAttachment,
  type PreparedAttachment,
  type SealAndSend
} from '../attachments'
import type { useSecureFiles } from './useSecureFiles'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type FileOutgoingInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  file?: FileMeta | null
  sentAt?: string
  replyToMessageId?: string | null
}

type UseMessageFilesOptions = {
  selectedUser: Ref<SelectedUser>
  replyingTo: Ref<UiMessage | null>

  sealAndSend: SealAndSend

  secureFiles: Pick<
    ReturnType<typeof useSecureFiles>,
    'registerLocal' | 'downloadDecrypted'
  >

  /** Explains a file that could not be sent or saved. */
  onFileError: (error: unknown) => void

  appendOutgoingMessage: (
    peerId: string,
    input: FileOutgoingInput
  ) => Promise<UiMessage>

  updateConversationAfterSend: (
    peerId: string,
    message: Pick<
      UiMessage,
      'plainText' | 'fileUrl' | 'sentAt'
    >,
    username?: string
  ) => void

  outbox: Outbox
}

export function useMessageFiles({
  selectedUser,
  replyingTo,
  sealAndSend,
  secureFiles,
  onFileError,
  appendOutgoingMessage,
  updateConversationAfterSend,
  outbox
}: UseMessageFilesOptions) {
  const fileInput =
    ref<HTMLInputElement | null>(null)

  const pendingFiles =
    ref<File[]>([])

  const pendingCaption = ref('')
  const showFileModal = ref(false)
  const sendingFile = ref(false)

  const downloaded =
    reactive<Record<string, boolean>>({})

  const downloading =
    reactive<Record<string, boolean>>({})

  const fileSizeMap =
    reactive<Record<string, number>>({})

  function openFilePicker() {
    fileInput.value?.click()
  }

  function onFilesChosen(event: Event) {
    const element =
      event.target as HTMLInputElement

    const files = element.files
      ? Array.from(element.files)
      : []

    if (files.length) {
      pendingFiles.value.push(...files)
      showFileModal.value = true
    }

    element.value = ''
  }

  function removePendingFile(index: number) {
    pendingFiles.value.splice(index, 1)

    if (!pendingFiles.value.length) {
      cancelFileSend()
    }
  }

  function cancelFileSend() {
    showFileModal.value = false
    pendingFiles.value = []
    pendingCaption.value = ''
  }

  function addAnotherFile() {
    fileInput.value?.click()
  }

  function fileKey(
    message: UiMessage
  ): string {
    return (
      message.id ||
      message.clientId ||
      ''
    )
  }

  function fileNameFromUrl(
    url: string
  ): string {
    try {
      const lastPart =
        url.split('/').pop() || ''

      const separatorIndex =
        lastPart.indexOf('_')

      const fileName =
        separatorIndex >= 0
          ? lastPart.slice(
              separatorIndex + 1
            )
          : lastPart

      return decodeURIComponent(
        fileName
      )
    } catch {
      return 'file'
    }
  }

  function humanFileSize(
    bytes: number
  ): string {
    if (!bytes) return ''

    const units = [
      'B',
      'KB',
      'MB',
      'GB'
    ]

    let value = bytes
    let unitIndex = 0

    while (
      value >= 1024 &&
      unitIndex < units.length - 1
    ) {
      value /= 1024
      unitIndex++
    }

    const precision =
      unitIndex === 0 ? 0 : 1

    return `${value.toFixed(
      precision
    )} ${units[unitIndex]}`
  }

  async function ensureFileSize(
    url: string,
    key: string
  ) {
    if (fileSizeMap[key]) return

    try {
      const response = await fetch(
        url,
        {
          method: 'HEAD'
        }
      )

      const size = Number.parseInt(
        response.headers.get(
          'content-length'
        ) || '0',
        10
      )

      if (size > 0) {
        fileSizeMap[key] = size
      }
    } catch {}
  }

  async function downloadFile(
    message: UiMessage
  ) {
    if (!message.fileUrl) return

    const key = fileKey(message)

    downloading[key] = true

    try {
      if (message.file) {
        // End-to-end encrypted: download, decrypt here, save under the original name.
        await secureFiles.downloadDecrypted(message)
        downloaded[key] = true
        return
      }

      void ensureFileSize(
        message.fileUrl,
        key
      )

      const anchor =
        document.createElement('a')

      anchor.href = message.fileUrl

      anchor.download =
        fileNameFromUrl(
          message.fileUrl
        )

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      downloaded[key] = true
    } catch (error) {
      console.warn('download failed', error)
      onFileError(error)
    } finally {
      downloading[key] = false
    }
  }

  async function confirmSendFile() {
    const user = selectedUser.value

    if (
      !user ||
      !pendingFiles.value.length
    ) {
      return
    }

    const partnerId = user.id

    const replyId =
      replyingTo.value?.id ?? null

    sendingFile.value = true

    try {
      const caption =
        pendingCaption.value.trim()

      const sentAt =
        new Date().toISOString()

      let lastOutgoing:
        UiMessage | null = null

      for (
        const file of pendingFiles.value
      ) {
        let attachment: PreparedAttachment

        try {
          attachment =
            await prepareAttachment(file)
        } catch (error) {
          // Too large or unreadable: skip it and say why; the others still go.
          onFileError(error)
          continue
        }

        const clientId =
          crypto.randomUUID()

        secureFiles.registerLocal(
          clientId,
          file,
          attachment.meta
        )

        const outgoing =
          await appendOutgoingMessage(
            partnerId,
            {
              clientId,
              plainText: caption,
              fileUrl: '(pending)',
              file: attachment.meta,
              sentAt,
              replyToMessageId:
                replyId
            }
          )

        lastOutgoing = outgoing

        // One failed file does not stop the others; it can be retried from its bubble.
        await outbox.send(clientId, () =>
          sendAttachment(
            sealAndSend,
            partnerId,
            attachment,
            {
              caption,
              clientId,
              replyToMessageId: replyId
            }
          )
        )
      }

      if (lastOutgoing) {
        updateConversationAfterSend(
          partnerId,
          lastOutgoing,
          user.username
        )
      }

      cancelFileSend()

      if (
        selectedUser.value?.id ===
        partnerId
      ) {
        replyingTo.value = null
      }
    } catch (error) {
      console.error(
        'send file failed',
        error
      )
    } finally {
      sendingFile.value = false
    }
  }

  /** Sends a recorded voice message (encrypted like any attachment, with its waveform). */
  async function sendVoice(blob: Blob, mime: string, voice: VoiceMeta) {
    const user = selectedUser.value
    if (!user) return

    const partnerId = user.id
    const replyId = replyingTo.value?.id ?? null
    const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: mime })

    let attachment: PreparedAttachment
    try {
      attachment = await prepareAttachment(file)
    } catch (error) {
      onFileError(error)
      return
    }
    attachment.meta.voice = voice

    const clientId = crypto.randomUUID()
    secureFiles.registerLocal(clientId, file, attachment.meta)

    const outgoing = await appendOutgoingMessage(partnerId, {
      clientId,
      plainText: '',
      fileUrl: '(pending)',
      file: attachment.meta,
      replyToMessageId: replyId
    })

    if (selectedUser.value?.id === partnerId) replyingTo.value = null

    await outbox.send(clientId, () =>
      sendAttachment(sealAndSend, partnerId, attachment, { caption: '', clientId, replyToMessageId: replyId })
    )

    updateConversationAfterSend(partnerId, outgoing, user.username)
  }

  return {
    sendVoice,
    fileInput,
    pendingFiles,
    pendingCaption,
    showFileModal,
    sendingFile,

    downloaded,
    downloading,
    fileSizeMap,

    openFilePicker,
    onFilesChosen,
    removePendingFile,
    cancelFileSend,
    addAnotherFile,
    confirmSendFile,

    fileKey,
    fileNameFromUrl,
    humanFileSize,
    ensureFileSize,
    downloadFile
  }
}