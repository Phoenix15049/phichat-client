export type MessageStatus = 'sending' | 'delivered' | 'read'

export type UiReaction = {
  emoji: string
  count: number
  mine?: boolean
}

export type UiMessage = {
  id?: string
  clientId?: string
  senderId: string
  plainText: string
  fileUrl: string | null
  status?: MessageStatus
  sentAt?: string
  deliveredAtUtc?: string | null
  readAtUtc?: string | null
  replyToMessageId?: string | null
  isDeleted?: boolean
  updatedAtUtc?: string | null
  reactions?: UiReaction[]
  forwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
  groupId?: string | null
}

export type UiConversation = {
  peerId: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  unreadCount: number
  lastSentAt?: string | null
  lastFileUrl?: string | null
  lastPreview?: string | null
}

export type ChatUser = {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  lastSeenUtc?: string | null
  phoneNumber?: string
}

export type UserApiItem = ChatUser & {
  Id?: string
  Username?: string
  DisplayName?: string
  AvatarUrl?: string
  Bio?: string
  LastSeenUtc?: string | null
  PhoneNumber?: string
  firstName?: string
  FirstName?: string
  lastName?: string
  LastName?: string
  name?: string
  Name?: string
}

export type Contact = {
  contactId: string
  username: string
  displayName?: string
  avatarUrl?: string
  userId?: string
  id?: string
  contactUserId?: string
  peerId?: string
}

export type ServerReaction = {
  emoji?: string
  Emoji?: string
  count?: number
  Count?: number
  mine?: boolean
  Mine?: boolean
}

export type ServerMessage = {
  id?: string
  messageId?: string
  MessageId?: string

  senderId?: string
  SenderId?: string

  encryptedText?: string
  EncryptedText?: string
  encryptedContent?: string
  EncryptedContent?: string

  fileUrl?: string | null
  FileUrl?: string | null

  sentAt?: string
  SentAt?: string
  deliveredAtUtc?: string | null
  DeliveredAtUtc?: string | null
  readAtUtc?: string | null
  ReadAtUtc?: string | null

  replyToMessageId?: string | null
  ReplyToMessageId?: string | null

  isDeleted?: boolean
  IsDeleted?: boolean
  isRead?: boolean
  IsRead?: boolean

  updatedAtUtc?: string | null
  UpdatedAtUtc?: string | null

  reactions?: ServerReaction[]
  Reactions?: ServerReaction[]

  forwardedFromMessageId?: string | null
  ForwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
  ForwardedFromSenderId?: string | null

}