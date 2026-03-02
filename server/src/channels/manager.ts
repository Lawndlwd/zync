import type {
  ChannelAdapter,
  ChannelType,
  MessageHandler,
  OutboundMessage,
} from './types.js'
import { logger } from '../lib/logger.js'

const MAX_LENGTHS: Record<ChannelType, number> = {
  telegram: 4096,
  whatsapp: 65536,
  gmail: Infinity,
}

export function splitMessage(text: string, maxLength: number): string[] {
  if (maxLength === Infinity || text.length <= maxLength) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLength))
    remaining = remaining.slice(maxLength)
  }
  return chunks
}

class ChannelManager {
  private adapters = new Map<ChannelType, ChannelAdapter>()
  private handler: MessageHandler | null = null

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.name, adapter)
    if (this.handler) {
      adapter.onMessage(this.handler)
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler
    for (const adapter of this.adapters.values()) {
      adapter.onMessage(handler)
    }
  }

  async startAll(): Promise<void> {
    const results = await Promise.allSettled(
      [...this.adapters.values()].map((a) => a.start()),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({ err: result.reason }, 'Failed to start channel adapter')
      }
    }
  }

  async stopAll(): Promise<void> {
    const results = await Promise.allSettled(
      [...this.adapters.values()].map((a) => a.stop()),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({ err: result.reason }, 'Failed to stop channel adapter')
      }
    }
  }

  async send(
    channelType: ChannelType,
    chatId: string,
    message: OutboundMessage,
  ): Promise<void> {
    const adapter = this.adapters.get(channelType)
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${channelType}`)
    }

    if (message.text) {
      const maxLength = MAX_LENGTHS[channelType]
      const chunks = splitMessage(message.text, maxLength)
      for (const chunk of chunks) {
        await adapter.send(chatId, { ...message, text: chunk })
      }
    } else {
      await adapter.send(chatId, message)
    }
  }

  async sendTyping(channelType: ChannelType, chatId: string): Promise<void> {
    const adapter = this.adapters.get(channelType)
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${channelType}`)
    }
    await adapter.sendTyping(chatId)
  }

  async unregister(channelType: ChannelType): Promise<void> {
    const adapter = this.adapters.get(channelType)
    if (adapter) {
      await adapter.stop()
      this.adapters.delete(channelType)
    }
  }

  getAdapter(channelType: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channelType)
  }

  getRegisteredChannels(): ChannelType[] {
    return [...this.adapters.keys()]
  }
}

let instance: ChannelManager | null = null

export function getChannelManager(): ChannelManager {
  if (!instance) {
    instance = new ChannelManager()
  }
  return instance
}
