export interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: string
  isUnread: boolean
}

export interface ThreadMessage {
  id: string
  from: string
  to: string
  subject: string
  body: string
  date: string
  messageId: string
}

export interface GmailThread {
  threadId: string
  messages: ThreadMessage[]
}

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
