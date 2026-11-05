import type { UiMessage } from '../../types/chat'

/** One photo or video of the chat, as the viewer shows it. */
export type MediaItem = {
  key: string
  kind: 'image' | 'video'
  src: string
  name: string
  caption: string
  message: UiMessage
  /** The chat it belongs to; the viewer can outlive it in picture in picture. */
  chat: { id: string; username: string; isGroup?: boolean }
  senderName: string
  senderAvatar: string | null
  date: string
}
