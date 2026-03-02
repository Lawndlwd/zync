import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  type WASocket,
  Browsers,
} from 'baileys'
import { resolve } from 'path'
import { existsSync, readdirSync, rmSync, mkdirSync } from 'fs'
import QRCode from 'qrcode'
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

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 5_000

export class WhatsAppAdapter implements ChannelAdapter {
  readonly name: ChannelType = 'whatsapp'
  private socket: WASocket | null = null
  private handlers: MessageHandler[] = []
  private config: WhatsAppAdapterConfig
  private _qrDataUrl: string | null = null
  private _connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  private _authenticated = false
  private _reconnectAttempts = 0
  private _stopped = false
  private _error: string | null = null
  /** Track message IDs sent by the bot to avoid infinite loops in self-chat */
  private _sentMessageIds = new Set<string>()

  constructor(config: WhatsAppAdapterConfig) {
    this.config = config
  }

  /** Current QR code as a data URL (png base64), or null if not waiting for scan */
  get qrDataUrl(): string | null {
    return this._qrDataUrl
  }

  get connectionState(): string {
    return this._connectionState
  }

  get lastError(): string | null {
    return this._error
  }

  /** Wipe auth dir so next start() gets a fresh QR */
  clearAuth(): void {
    const authDir = resolve(this.config.authDir)
    if (existsSync(authDir)) {
      for (const f of readdirSync(authDir)) {
        rmSync(resolve(authDir, f), { force: true, recursive: true })
      }
      console.log('WhatsApp: auth state cleared')
    }
  }

  async start(): Promise<void> {
    this._stopped = false
    this._error = null
    this._connectionState = 'connecting'
    const authDir = resolve(this.config.authDir)

    // Ensure auth dir exists
    if (!existsSync(authDir)) {
      mkdirSync(authDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    // Fetch the latest WA Web version to avoid 405 rejections
    let version: [number, number, number] | undefined
    try {
      const result = await fetchLatestWaWebVersion({})
      version = result.version as [number, number, number]
      console.log(`WhatsApp: using WA Web version ${version.join('.')}`)
    } catch {
      console.log('WhatsApp: could not fetch latest version, using default')
    }

    console.log(`WhatsApp: connecting (auth=${!!state.creds?.me ? 'exists' : 'new'})...`)

    const socket = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Chrome'),
      qrTimeout: 60_000,
      ...(version ? { version } : {}),
    })
    this.socket = socket

    // Save credentials on update
    socket.ev.on('creds.update', saveCreds)

    // Handle connection updates
    socket.ev.on('connection.update', async (update) => {
      if (this._stopped) return

      if (update.connection) {
        console.log(`WhatsApp: connection=${update.connection}`)
      }

      const { connection, lastDisconnect, qr } = update

      // Capture QR code and convert to data URL for the frontend
      if (qr) {
        try {
          this._qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
          this._connectionState = 'connecting'
          this._error = null
          console.log('WhatsApp: QR code ready for scanning')
        } catch (err) {
          console.error('WhatsApp: failed to generate QR data URL:', err)
          this._qrDataUrl = null
        }
      }

      if (connection === 'close') {
        this._qrDataUrl = null
        const boom = lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined
        const statusCode = boom?.output?.statusCode
        const errorMsg = boom?.message || `Status ${statusCode}`
        const isLoggedOut = statusCode === DisconnectReason.loggedOut
        const isTimedOut = statusCode === DisconnectReason.timedOut

        console.log(`WhatsApp: connection closed — status=${statusCode}, msg=${errorMsg}`)

        if (isLoggedOut) {
          this._connectionState = 'disconnected'
          this._authenticated = false
          this._error = 'Logged out from WhatsApp'
          this.clearAuth()
          return
        }

        if (isTimedOut && !this._authenticated) {
          // QR code expired without being scanned
          this._connectionState = 'disconnected'
          this._error = 'QR code expired. Click Connect to generate a new one.'
          console.log('WhatsApp: QR timed out, not retrying')
          return
        }

        // 515 = restartRequired — expected after first pairing, always reconnect
        const isRestartRequired = statusCode === DisconnectReason.restartRequired
        if (isRestartRequired) {
          this._connectionState = 'connecting'
          this._error = null
          console.log('WhatsApp: restart required (expected after pairing), reconnecting...')
          setTimeout(() => {
            if (!this._stopped) this.start()
          }, 1_000)
          return
        }

        // Auto-reconnect if we had a working session
        if (this._authenticated && this._reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this._connectionState = 'connecting'
          this._reconnectAttempts++
          this._error = `Reconnecting (${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
          console.log(`WhatsApp: reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${this._reconnectAttempts})`)
          setTimeout(() => {
            if (!this._stopped) this.start()
          }, RECONNECT_DELAY_MS)
        } else {
          this._connectionState = 'disconnected'
          if (!this._authenticated) {
            this._error = `Connection failed (${errorMsg}). WhatsApp may be rate-limiting — wait a few minutes then try again.`
            // Clear auth so next attempt gets fresh state
            this.clearAuth()
          } else {
            this._error = 'Disconnected after max reconnect attempts'
          }
          console.log(`WhatsApp: giving up — ${this._error}`)
        }
      } else if (connection === 'open') {
        this._connectionState = 'connected'
        this._authenticated = true
        this._reconnectAttempts = 0
        this._qrDataUrl = null
        this._error = null
        console.log('WhatsApp: connected successfully!')
      }
    })

    // Handle incoming messages
    socket.ev.on('messages.upsert', async (upsert) => {
      for (const msg of upsert.messages) {
        const chatId = msg.key.remoteJid
        if (!chatId) continue

        const me = this.socket?.user
        const myNumber = me?.id?.split(':')[0]?.split('@')[0]
        const myLid = me?.lid?.split(':')[0]?.split('@')[0]
        const chatNumber = chatId.split(':')[0]?.split('@')[0]
        const isSelfChat = !!chatNumber && (chatNumber === myNumber || chatNumber === myLid)

        if (msg.key.fromMe) {
          // In self-chat: allow own messages (so you can talk to the AI)
          // but skip messages the bot sent (prevent infinite loop)
          if (!isSelfChat) continue
          if (this._sentMessageIds.has(msg.key.id || '')) {
            this._sentMessageIds.delete(msg.key.id || '')
            continue
          }
        }

        if (
          this.config.allowedNumbers &&
          this.config.allowedNumbers.length > 0 &&
          !isSelfChat &&
          !this.config.allowedNumbers.includes(chatId)
        ) {
          continue
        }

        const messageContent = msg.message
        if (!messageContent) continue

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

    console.log('WhatsApp adapter started, waiting for connection...')
  }

  async stop(): Promise<void> {
    this._stopped = true
    if (this.socket) {
      this.socket.end(undefined)
      this.socket = null
    }
    this._qrDataUrl = null
    this._connectionState = 'disconnected'
  }

  async send(chatId: string, message: OutboundMessage): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp socket not started')

    if (message.text) {
      const sent = await this.socket.sendMessage(chatId, {
        text: message.text,
        ...(message.replyToId ? { quoted: undefined } : {}),
      })
      // Track sent message ID to prevent self-chat infinite loops
      if (sent?.key?.id) {
        this._sentMessageIds.add(sent.key.id)
        // Clean up old IDs after 30s to prevent memory leak
        setTimeout(() => this._sentMessageIds.delete(sent.key.id!), 30_000)
      }
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
