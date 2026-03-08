import { Bot } from 'grammy'
import type {
  ChannelAdapter,
  ChannelType,
  InboundMessage,
  MessageHandler,
  OutboundMessage,
} from './types.js'
import { logger } from '../lib/logger.js'
import { handleSupportMessage } from '../telegram/support.js'
import { handleTelegramDM } from '../telegram/triage.js'

interface TelegramAdapterConfig {
  botToken: string
  allowedUsers: number[]
}

export class TelegramAdapter implements ChannelAdapter {
  readonly name: ChannelType = 'telegram'
  private bot: Bot | null = null
  private handlers: MessageHandler[] = []
  private config: TelegramAdapterConfig

  constructor(config: TelegramAdapterConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    const bot = new Bot(this.config.botToken)
    this.bot = bot

    // Route: owner messages go through normal pipeline, non-owner go to support
    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id
      if (!userId) return

      // Business messages are handled separately
      if ((ctx as any).businessMessage) return await next()

      // Owner — proceed to normal handlers (handleMessage pipeline)
      if (this.config.allowedUsers.length === 0 || this.config.allowedUsers.includes(userId)) {
        return await next()
      }

      // Non-owner — route to support handler
      if (ctx.message?.text) {
        const msg: InboundMessage = {
          id: String(ctx.message.message_id),
          channelType: 'telegram',
          chatId: String(ctx.chat!.id),
          senderId: String(ctx.from.id),
          senderName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
          text: ctx.message.text,
          timestamp: new Date(ctx.message.date * 1000),
          raw: ctx,
        }
        await handleSupportMessage(msg)
      }
    })

    // Log all updates for debugging
    bot.use(async (ctx, next) => {
      logger.info({ updateType: ctx.updateType, from: ctx.from?.id }, 'Telegram: received update')
      await next()
    })

    // Handle text messages
    bot.on('message:text', async (ctx) => {
      const msg: InboundMessage = {
        id: String(ctx.message.message_id),
        channelType: 'telegram',
        chatId: String(ctx.chat.id),
        senderId: String(ctx.from.id),
        senderName:
          ctx.from.first_name +
          (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
        text: ctx.message.text,
        replyToId: ctx.message.reply_to_message
          ? String(ctx.message.reply_to_message.message_id)
          : undefined,
        timestamp: new Date(ctx.message.date * 1000),
        raw: ctx,
      }
      await this.dispatch(msg)
    })

    // Handle voice messages
    bot.on('message:voice', async (ctx) => {
      const file = await ctx.getFile()
      const fileUrl = `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`

      const msg: InboundMessage = {
        id: String(ctx.message.message_id),
        channelType: 'telegram',
        chatId: String(ctx.chat.id),
        senderId: String(ctx.from.id),
        senderName:
          ctx.from.first_name +
          (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
        mediaType: 'audio',
        mediaUrl: fileUrl,
        replyToId: ctx.message.reply_to_message
          ? String(ctx.message.reply_to_message.message_id)
          : undefined,
        timestamp: new Date(ctx.message.date * 1000),
        raw: ctx,
      }
      await this.dispatch(msg)
    })

    // Handle photo messages
    bot.on('message:photo', async (ctx) => {
      const photos = ctx.message.photo
      const largest = photos[photos.length - 1]
      const file = await ctx.api.getFile(largest.file_id)
      const fileUrl = `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`

      const msg: InboundMessage = {
        id: String(ctx.message.message_id),
        channelType: 'telegram',
        chatId: String(ctx.chat.id),
        senderId: String(ctx.from.id),
        senderName:
          ctx.from.first_name +
          (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
        text: ctx.message.caption ?? undefined,
        mediaType: 'image',
        mediaUrl: fileUrl,
        replyToId: ctx.message.reply_to_message
          ? String(ctx.message.reply_to_message.message_id)
          : undefined,
        timestamp: new Date(ctx.message.date * 1000),
        raw: ctx,
      }
      await this.dispatch(msg)
    })

    // Handle Business Mode DMs (personal account messages forwarded to bot)
    bot.on('business_message' as any, async (ctx: any) => {
      const bm = ctx.businessMessage
      if (!bm) return

      // Skip owner's own messages (prevent reply loops)
      if (this.config.allowedUsers.includes(bm.from.id)) return

      if (!bm.text) return

      const senderName = bm.from.first_name + (bm.from.last_name ? ` ${bm.from.last_name}` : '')
      await handleTelegramDM(
        bot,
        bm.business_connection_id,
        String(bm.chat.id),
        String(bm.from.id),
        senderName,
        bm.from.username,
        bm.text,
      )
    })

    // Error handler
    bot.catch((err) => {
      logger.error({ err }, 'Telegram bot error')
    })

    // bot.start() blocks forever (long-polling), so fire-and-forget
    bot.start().catch((err) => {
      logger.error({ err }, 'Telegram long-polling crashed')
    })
    logger.info({ allowedUsers: this.config.allowedUsers }, 'Telegram adapter started')
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop()
      this.bot = null
    }
  }

  async send(chatId: string, message: OutboundMessage): Promise<void> {
    if (!this.bot) throw new Error('Telegram bot not started')

    if (message.mediaUrl && message.mediaType === 'image') {
      await this.bot.api.sendPhoto(chatId, message.mediaUrl, {
        caption: message.text,
        ...(message.replyToId
          ? { reply_parameters: { message_id: Number(message.replyToId) } }
          : {}),
      })
    } else if (message.text) {
      await this.bot.api.sendMessage(chatId, message.text, {
        ...(message.replyToId
          ? { reply_parameters: { message_id: Number(message.replyToId) } }
          : {}),
      })
    }
  }

  async sendTyping(chatId: string): Promise<void> {
    if (!this.bot) throw new Error('Telegram bot not started')
    await this.bot.api.sendChatAction(chatId, 'typing')
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler)
  }

  getBotInstance(): Bot {
    if (!this.bot) throw new Error('Telegram bot not started')
    return this.bot
  }

  private async dispatch(msg: InboundMessage): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(msg)
      } catch (err) {
        logger.error({ err }, 'Error in message handler')
      }
    }
  }
}
