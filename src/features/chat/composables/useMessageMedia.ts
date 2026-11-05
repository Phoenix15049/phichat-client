import {
  computed,
  ref,
  type Ref
} from 'vue'

import type {
  ChatUser,
  UiMessage
} from '../../../types/chat'
import type { FileMeta } from '../../../services/e2ee/messageCodec'
import type { Outbox } from './useOutbox'
import {
  prepareAttachment,
  sendAttachment,
  type PreparedAttachment,
  type SealAndSend
} from '../attachments'
import type { useSecureFiles } from './useSecureFiles'
import { MAX_ALBUM_ITEMS } from '../albumLayout'
import type { AlbumMeta } from '../../../services/e2ee/messageCodec'

type SelectedUser =
  Pick<ChatUser, 'id' | 'username'> | null

type MediaOutgoingInput = {
  clientId?: string
  plainText: string
  fileUrl: string | null
  file?: FileMeta | null
  sentAt?: string
  replyToMessageId?: string | null
  groupId?: string | null
  album?: AlbumMeta | null
}

type UseMessageMediaOptions = {
  selectedUser: Ref<SelectedUser>
  replyingTo: Ref<UiMessage | null>

  sealAndSend: SealAndSend

  secureFiles: Pick<
    ReturnType<typeof useSecureFiles>,
    'registerLocal'
  >

  /** Explains an item that could not be sent. */
  onMediaError: (error: unknown) => void

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

  outbox: Outbox
}

export function useMessageMedia({
  selectedUser,
  replyingTo,
  sealAndSend,
  secureFiles,
  onMediaError,
  appendOutgoingMessage,
  updateConversationAfterSend,
  outbox
}: UseMessageMediaOptions) {
  const mediaInput =
    ref<HTMLInputElement | null>(null)

  const pendingMedia =
    ref<File[]>([])

  const showMediaModal = ref(false)
  const sendingMedia = ref(false)
  const mediaCaption = ref('')
  /** Several items go out together as an album unless the user says otherwise. */
  const mediaGroupItems = ref(true)
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
    mediaGroupItems.value = true

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
      // Everything is prepared first, so the whole album appears at once and fills in as it uploads.
      const prepared: Array<{ file: File; attachment: PreparedAttachment }> = []

      for (const original of files) {
        let file = original

        if (shouldCompress && isImageFile(file)) {
          try {
            file = await compressImageFile(file)
          } catch {}
        }

        try {
          prepared.push({ file, attachment: await prepareAttachment(file) })
        } catch (error) {
          // Too large or unreadable: skip it and say why; the others still go.
          onMediaError(error)
        }
      }

      const sentAt = new Date().toISOString()
      const jobs: Array<() => Promise<boolean>> = []
      let firstOutgoing: UiMessage | null = null

      for (let start = 0; start < prepared.length; start += groupItems ? MAX_ALBUM_ITEMS : 1) {
        const chunk = groupItems ? prepared.slice(start, start + MAX_ALBUM_ITEMS) : [prepared[start]]
        const albumId = chunk.length > 1 ? crypto.randomUUID() : null

        for (let index = 0; index < chunk.length; index++) {
          const { file, attachment } = chunk[index]
          const clientId = crypto.randomUUID()
          const first = !firstOutgoing
          const plainText = first ? caption : ''
          const album = albumId ? { id: albumId, index, count: chunk.length } : null
          const replyToMessageId = first ? replyId : null

          secureFiles.registerLocal(clientId, file, attachment.meta)

          const outgoing = await appendOutgoingMessage(partnerId, {
            clientId,
            plainText,
            fileUrl: '(pending)',
            file: attachment.meta,
            sentAt,
            replyToMessageId,
            album
          })
          firstOutgoing ??= outgoing

          // One failed item does not stop the others; it can be retried from its place in the album.
          jobs.push(() => outbox.send(clientId, () =>
            sendAttachment(sealAndSend, partnerId, attachment, { caption: plainText, clientId, replyToMessageId, album })
          ))
        }
      }

      if (firstOutgoing) {
        updateConversationAfterSend(partnerId, firstOutgoing, user.username)
      }

      // The compression choice stays for the next send.
      clearMediaState(false)

      if (selectedUser.value?.id === partnerId) {
        replyingTo.value = null
      }

      for (const job of jobs) await job()
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