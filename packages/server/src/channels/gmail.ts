import { google, type gmail_v1 } from 'googleapis'
import { readFileSync, existsSync } from 'fs'
import type { ChannelAdapter, InboundMessage, OutboundMessage, MessageHandler } from './types.js'
import { logger } from '../lib/logger.js'

export interface GmailConfig {
  credentialsPath: string
  tokenPath: string
  pollIntervalMs: number
}

export class GmailAdapter implements ChannelAdapter {
  readonly name = 'gmail' as const
  private config: GmailConfig
  private gmail: gmail_v1.Gmail | null = null
  private handlers: MessageHandler[] = []
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastHistoryId: string | null = null

  constructor(config: GmailConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    if (!existsSync(this.config.credentialsPath)) {
      logger.warn('Gmail: credentials file not found, skipping')
      return
    }
    if (!existsSync(this.config.tokenPath)) {
      logger.warn('Gmail: token file not found. Run OAuth flow first.')
      return
    }

    const credentials = JSON.parse(readFileSync(this.config.credentialsPath, 'utf-8'))
    const token = JSON.parse(readFileSync(this.config.tokenPath, 'utf-8'))

    const { client_id, client_secret } = credentials.installed || credentials.web || {}
    const auth = new google.auth.OAuth2(client_id, client_secret)
    auth.setCredentials(token)

    this.gmail = google.gmail({ version: 'v1', auth })

    const profile = await this.gmail.users.getProfile({ userId: 'me' })
    this.lastHistoryId = profile.data.historyId || null

    this.pollTimer = setInterval(() => this.poll(), this.config.pollIntervalMs)
    logger.info({ pollIntervalSec: this.config.pollIntervalMs / 1000 }, 'Gmail channel started')
  }

  private async poll(): Promise<void> {
    if (!this.gmail || !this.lastHistoryId) return

    try {
      const history = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: this.lastHistoryId,
        historyTypes: ['messageAdded'],
      })

      if (history.data.history) {
        for (const h of history.data.history) {
          for (const added of h.messagesAdded || []) {
            if (!added.message?.id) continue
            await this.processMessage(added.message.id)
          }
        }
      }

      if (history.data.historyId) {
        this.lastHistoryId = history.data.historyId
      }
    } catch (err: any) {
      if (err.code === 404) {
        const profile = await this.gmail!.users.getProfile({ userId: 'me' })
        this.lastHistoryId = profile.data.historyId || null
      } else {
        logger.error({ err }, 'Gmail poll error')
      }
    }
  }

  private async processMessage(messageId: string): Promise<void> {
    if (!this.gmail) return

    const msg = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const headers = msg.data.payload?.headers || []
    const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'unknown'
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(no subject)'

    let body = ''
    const payload = msg.data.payload
    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, 'base64url').toString('utf-8')
    } else if (payload?.parts) {
      const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
      }
    }

    const inbound: InboundMessage = {
      id: messageId,
      channelType: 'gmail',
      chatId: from,
      senderId: from,
      senderName: from.split('<')[0].trim() || from,
      text: `Subject: ${subject}\n\n${body}`.trim(),
      timestamp: new Date(Number(msg.data.internalDate)),
      raw: msg.data,
    }

    for (const handler of this.handlers) {
      await handler(inbound)
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  async send(chatId: string, message: OutboundMessage): Promise<void> {
    if (!this.gmail || !message.text) return

    const raw = [
      `To: ${chatId}`,
      'Content-Type: text/plain; charset=utf-8',
      'Subject: Re: AI Assistant',
      '',
      message.text,
    ].join('\n')

    const encoded = Buffer.from(raw).toString('base64url')
    await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    })
  }

  async sendTyping(_chatId: string): Promise<void> {
    // Gmail has no typing indicator
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler)
  }
}
