export type ChannelType = 'telegram' | 'whatsapp' | 'gmail'
export type MediaType = 'image' | 'audio' | 'video' | 'document'

export interface InboundMessage {
  id: string
  channelType: ChannelType
  chatId: string
  senderId: string
  senderName: string
  text?: string
  mediaUrl?: string
  mediaType?: MediaType
  mediaBuffer?: Buffer
  replyToId?: string
  timestamp: Date
  raw: unknown
}

export interface OutboundMessage {
  text?: string
  mediaUrl?: string
  mediaType?: MediaType
  replyToId?: string
}

export type MessageHandler = (msg: InboundMessage) => Promise<void>

export interface ChannelAdapter {
  readonly name: ChannelType
  start(): Promise<void>
  stop(): Promise<void>
  send(chatId: string, message: OutboundMessage): Promise<void>
  sendTyping(chatId: string): Promise<void>
  onMessage(handler: MessageHandler): void
}

export interface ChannelConfig {
  enabled: boolean
  [key: string]: unknown
}

export interface ChannelsConfig {
  telegram: ChannelConfig & {
    botToken: string
    allowedUsers: number[]
  }
  whatsapp: ChannelConfig & {
    authDir: string
  }
  gmail: ChannelConfig & {
    clientId: string
    clientSecret: string
    refreshToken: string
  }
}
