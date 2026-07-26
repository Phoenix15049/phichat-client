import {
  computed,
  ref,
  type Ref
} from 'vue'

import {
  sendMessageWithFileFD
} from '../services/api'

import {
  encryptAES
} from '../services/crypto'

import {
  sendMessage
} from '../services/signalr'

import type {
  ChatUser,
  UiMessage
} from '../types/chat'

const EMPTY_MSG_MARKER = '\u200B'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type MediaOutgoingInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  sentAt?: string
  replyToMessageId?: string | null
  groupId?: string | null
}

type UseMessageMediaOptions = {
  selectedUser: Ref<SelectedUser>
  replyingTo: Ref<UiMessage | null>

  getOrLoadKey:
    (partnerId: string) => Promise<CryptoKey>

  appendOutgoingMessage: (
    peerId: string,
    input: MediaOutgoingInput
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

export function useMessageMedia({
  selectedUser,
  replyingTo,
  getOrLoadKey,
  appendOutgoingMessage,
  updateConversationAfterSend
}: UseMessageMediaOptions) {
  const mediaInput =
    ref<HTMLInputElement | null>(null)

  const pendingMedia =
    ref<File[]>([])

  const showMediaModal = ref(false)
  const sendingMedia = ref(false)
  const mediaCaption = ref('')
  const mediaGroupItems = ref(false)
  const compressImages = ref(true)

  const previewUrls =
    new Map<File, string>()

  function isImageFile(file: File) {
    return file.type.startsWith('image/')
  }

  const allImagesSelected = computed(
    () =>
      pendingMedia.value.length > 0 &&
      pendingMedia.value.every(
        isImageFile
      )
  )

  function objUrl(file: File) {
    const existing =
      previewUrls.get(file)

    if (existing) {
      return existing
    }

    const url =
      URL.createObjectURL(file)

    previewUrls.set(file, url)

    return url
  }

  function revokePreview(file: File) {
    const url =
      previewUrls.get(file)

    if (!url) return

    URL.revokeObjectURL(url)
    previewUrls.delete(file)
  }

  function revokeAllPreviews() {
    for (const url of previewUrls.values()) {
      URL.revokeObjectURL(url)
    }

    previewUrls.clear()
  }

  function openMediaPicker() {
    mediaInput.value?.click()
  }

  function onMediaChosen(event: Event) {
    const element =
      event.target as HTMLInputElement

    const files = element.files
      ? Array.from(element.files)
      : []

    if (files.length) {
      pendingMedia.value.push(...files)
      showMediaModal.value = true
    }

    element.value = ''
  }

  function addAnotherMedia() {
    mediaInput.value?.click()
  }

  function removePendingMedia(index: number) {
    const removed =
      pendingMedia.value[index]

    pendingMedia.value.splice(index, 1)

    if (removed) {
      revokePreview(removed)
    }

    if (!pendingMedia.value.length) {
      cancelMediaSend()
    }
  }

  function clearMediaState(
    resetCompression: boolean
  ) {
    revokeAllPreviews()

    showMediaModal.value = false
    pendingMedia.value = []
    mediaCaption.value = ''
    mediaGroupItems.value = false

    if (resetCompression) {
      compressImages.value = true
    }
  }

  function cancelMediaSend() {
    clearMediaState(true)
  }

  async function compressImageFile(
    file: File,
    maxDimension = 1280,
    quality = 0.82
  ): Promise<File> {
    const sourceUrl =
      URL.createObjectURL(file)

    try {
      const image =
        await new Promise<HTMLImageElement>(
          (resolve, reject) => {
            const element = new Image()

            element.onload = () =>
              resolve(element)

            element.onerror = () =>
              reject(
                new Error(
                  'Image could not be loaded'
                )
              )

            element.src = sourceUrl
          }
        )

      const width =
        image.naturalWidth

      const height =
        image.naturalHeight

      let targetWidth = width
      let targetHeight = height

      if (
        width > height &&
        width > maxDimension
      ) {
        targetWidth = maxDimension

        targetHeight =
          Math.round(
            height *
            maxDimension /
            width
          )
      } else if (
        height >= width &&
        height > maxDimension
      ) {
        targetHeight = maxDimension

        targetWidth =
          Math.round(
            width *
            maxDimension /
            height
          )
      }

      const canvas =
        document.createElement('canvas')

      canvas.width = targetWidth
      canvas.height = targetHeight

      const context =
        canvas.getContext('2d')

      if (!context) {
        throw new Error(
          'Canvas is not available'
        )
      }

      context.drawImage(
        image,
        0,
        0,
        targetWidth,
        targetHeight
      )

      const blob =
        await new Promise<Blob>(
          (resolve, reject) => {
            canvas.toBlob(
              result => {
                if (result) {
                  resolve(result)
                } else {
                  reject(
                    new Error(
                      'Image compression failed'
                    )
                  )
                }
              },
              'image/jpeg',
              quality
            )
          }
        )

      return new File(
        [blob],
        file.name.replace(
          /\.[^.]+$/,
          '.jpg'
        ),
        {
          type: 'image/jpeg',
          lastModified: file.lastModified
        }
      )
    } finally {
      URL.revokeObjectURL(sourceUrl)
    }
  }

  async function confirmSendMedia() {
    const user = selectedUser.value

    if (
      !user ||
      !pendingMedia.value.length ||
      sendingMedia.value
    ) {
      return
    }

    const partnerId = user.id

    const replyId =
      replyingTo.value?.id ?? null

    const files = [
      ...pendingMedia.value
    ]

    const caption =
      mediaCaption.value.trim()

    const groupItems =
      mediaGroupItems.value

    const shouldCompress =
      compressImages.value

    sendingMedia.value = true

    try {
      const key =
        await getOrLoadKey(partnerId)

      const hasCaption =
        caption.length > 0

      const encryptedCaption =
        await encryptAES(
          key,
          hasCaption
            ? caption
            : EMPTY_MSG_MARKER
        )

      let lastOutgoing:
        UiMessage | null = null

      if (
        !groupItems &&
        hasCaption
      ) {
        const captionMessage =
          await appendOutgoingMessage(
            partnerId,
            {
              plainText: caption,
              fileUrl: null
            }
          )

        await sendMessage(
          partnerId,
          encryptedCaption,
          null,
          captionMessage.clientId ??
            null
        )

        lastOutgoing =
          captionMessage
      }

      const groupId =
        groupItems
          ? crypto.randomUUID()
          : null

      const sentAt =
        new Date().toISOString()

      for (
        let index = 0;
        index < files.length;
        index++
      ) {
        let file = files[index]

        if (
          shouldCompress &&
          isImageFile(file)
        ) {
          try {
            file =
              await compressImageFile(
                file
              )
          } catch {}
        }

        const clientId =
          crypto.randomUUID()

        const plainText =
          groupItems &&
          index === 0
            ? caption
            : ''

        const outgoing =
          await appendOutgoingMessage(
            partnerId,
            {
              clientId,
              plainText,
              fileUrl: '(pending)',
              sentAt,
              replyToMessageId:
                replyId,
              groupId
            }
          )

        lastOutgoing = outgoing

        const formData =
          new FormData()

        formData.append(
          'receiverId',
          partnerId
        )

        const encryptedText =
          groupItems &&
          index === 0
            ? encryptedCaption
            : await encryptAES(
                key,
                EMPTY_MSG_MARKER
              )

        formData.append(
          'encryptedText',
          encryptedText
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

        if (groupId) {
          formData.append(
            'groupId',
            groupId
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

      // رفتار فعلی حفظ می‌شود:
      // بعد از ارسال، مقدار compression
      // برای ارسال بعدی باقی می‌ماند.
      clearMediaState(false)

      if (
        selectedUser.value?.id ===
        partnerId
      ) {
        replyingTo.value = null
      }
    } catch (error) {
      console.error(
        'send media failed',
        error
      )
    } finally {
      sendingMedia.value = false
    }
  }

  function disposeMedia() {
    revokeAllPreviews()
  }

  return {
    mediaInput,
    pendingMedia,
    showMediaModal,
    sendingMedia,
    mediaCaption,
    mediaGroupItems,
    compressImages,
    allImagesSelected,

    openMediaPicker,
    onMediaChosen,
    addAnotherMedia,
    removePendingMedia,
    cancelMediaSend,
    confirmSendMedia,

    isImageFile,
    objUrl,
    disposeMedia
  }
}