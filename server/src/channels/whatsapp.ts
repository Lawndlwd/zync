import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys'
import { resolve } from 'path'
import type {
  ChannelAdapter,
  ChannelType,
  InboundMessage,
  MediaType,
  MessageHandler,
  OutboundMessage,
} from './types.js'

interface WhatsAppAdapterConfig {
  authDir: string
  allowedNumbers?: string[]
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly name: ChannelType = 'whatsapp'
  private socket: WASocket | null = null
  private handlers: MessageHandler[] = []
  private config: WhatsAppAdapterConfig

  constructor(config: WhatsAppAdapterConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    const authDir = resolve(this.config.authDir)
    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    })
    this.socket = socket

    // Save credentials on update
    socket.ev.on('creds.update', saveCreds)

    // Handle connection updates
    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update
      if (connection === 'close') {
        const boom = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        const statusCode = boom?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        console.log(
          `WhatsApp connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`,
        )
        if (shouldReconnect) {
          this.start()
        }
      } else if (connection === 'open') {
        console.log('WhatsApp adapter connected')
      }
    })

    // Handle incoming messages
    socket.ev.on('messages.upsert', async (upsert) => {
      for (const msg of upsert.messages) {
        // Skip messages sent by us
        if (msg.key.fromMe) continue

        const chatId = msg.key.remoteJid
        if (!chatId) continue

        // Filter by allowed numbers if configured
        if (
          this.config.allowedNumbers &&
          this.config.allowedNumbers.length > 0 &&
          !this.config.allowedNumbers.includes(chatId)
        ) {
          continue
        }

        const messageContent = msg.message
        if (!messageContent) continue

        // Extract text from various message types
        let text: string | undefined
        let mediaType: MediaType | undefined

        if (messageContent.conversation) {
          text = messageContent.conversation
        } else if (messageContent.extendedTextMessage) {
          text = messageContent.extendedTextMessage.text ?? undefined
        } else if (messageContent.imageMessage) {
          text = messageContent.imageMessage.caption ?? undefined
          mediaType = 'image'
        } else if (messageContent.videoMessage) {
          text = messageContent.videoMessage.caption ?? undefined
          mediaType = 'video'
        } else if (messageContent.audioMessage) {
          mediaType = 'audio'
        } else if (messageContent.documentMessage) {
          text = messageContent.documentMessage.caption ?? undefined
          mediaType = 'document'
        }

        // Only process if there's text or media
        if (!text && !mediaType) continue

        const senderId = chatId
        const senderName = msg.pushName || senderId

        const inbound: InboundMessage = {
          id: msg.key.id || String(Date.now()),
          channelType: 'whatsapp',
          chatId,
          senderId,
          senderName,
          text,
          mediaType,
          replyToId: messageContent.extendedTextMessage?.contextInfo?.stanzaId ?? undefined,
          timestamp: new Date((msg.messageTimestamp as number) * 1000),
          raw: msg,
        }

        await this.dispatch(inbound)
      }
    })

    console.log('WhatsApp adapter started')
  }

  async stop(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined)
      this.socket = null
    }
  }

  async send(chatId: string, message: OutboundMessage): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp socket not started')

    if (message.text) {
      await this.socket.sendMessage(chatId, {
        text: message.text,
        ...(message.replyToId ? { quoted: undefined } : {}),
      })
    }
  }

  async sendTyping(chatId: string): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp socket not started')
    await this.socket.sendPresenceUpdate('composing', chatId)
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler)
  }

  private async dispatch(msg: InboundMessage): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(msg)
      } catch (err) {
        console.error('Error in WhatsApp message handler:', err)
      }
    }
  }
}
