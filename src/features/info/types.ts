import type { UiMessage } from '../../types/chat'
import type { FileKind } from '../chat/composables/useSecureFiles'

/** What the shared media lists do with a message; ChatView provides them. */
export type InfoActions = {
  fileKind: (message: UiMessage) => FileKind
  mediaSrc: (message: UiMessage) => string | null
  mediaState: (message: UiMessage) => 'idle' | 'loading' | 'ready' | 'error'
  ensureMedia: (message: UiMessage) => void
  /** Opens a photo or video in the viewer, among the chat's other media. */
  openMedia: (message: UiMessage) => void
  /** Plays a voice or music message; `list` is what follows it. */
  playAudio: (message: UiMessage, list: UiMessage[]) => void
  download: (message: UiMessage) => void | Promise<void>
  /** Closes the panel and shows the message in its chat. */
  goTo: (message: UiMessage) => void
  humanFileSize: (bytes: number) => string
  fileKey: (message: UiMessage) => string
  downloading: Record<string, boolean>
  downloaded: Record<string, boolean>
}
