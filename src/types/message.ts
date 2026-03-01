export interface Message {
  id: string
  sender: string
  senderAvatar?: string
  channel: string
  content: string
  timestamp: string
  isRead: boolean
  isArchived: boolean
  priority: 'high' | 'normal' | 'low'
  threadId?: string
}

export interface MessageThread {
  id: string
  messages: Message[]
  summary?: string
}
