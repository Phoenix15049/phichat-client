import {
  reactive,
  ref,
  type Ref
} from 'vue'

import {
  sendMessageWithFileFD
} from '../../../services/api'

import {
  encryptAES
} from '../../../services/crypto'

import type {
  ChatUser,
  UiMessage
} from '../../../types/chat'

const EMPTY_MSG_MARKER = '\u200B'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type FileOutgoingInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  sentAt?: string
  replyToMessageId?: string | null
}

type UseMessageFilesOptions = {
  selectedUser: Ref<SelectedUser>
  replyingTo: Ref<UiMessage | null>

  getOrLoadKey:
    (partnerId: string) => Promise<CryptoKey>

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
}

export function useMessageFiles({
  selectedUser,
  replyingTo,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend
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
      const key =
        await getOrLoadKey(partnerId)

      const caption =
        pendingCaption.value.trim()

      const encryptedCaption =
        await encryptAES(
          key,
          caption || EMPTY_MSG_MARKER
        )

      const sentAt =
        new Date().toISOString()

      let lastOutgoing:
        UiMessage | null = null

      for (
        const file of pendingFiles.value
      ) {
        const clientId =
          crypto.randomUUID()

        const outgoing =
          await appendOutgoingMessage(
            partnerId,
            {
              clientId,
              plainText: caption,
              fileUrl: '(pending)',
              sentAt,
              replyToMessageId:
                replyId
            }
          )

        lastOutgoing = outgoing

        const formData =
          new FormData()

        formData.append(
          'receiverId',
          partnerId
        )

        formData.append(
          'encryptedText',
          encryptedCaption
        )

        formData.append(
          'file',
          file
        )

        if (replyId) {
          formData.append(
            'replyToMessageId',
            replyId
          )
        }

        formData.append(
          'clientId',
          clientId
        )

        await sendMessageWithFileFD(
          formData
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

  return {
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