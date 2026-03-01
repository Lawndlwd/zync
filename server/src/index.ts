import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { config } from 'dotenv'
import { jiraRouter } from './routes/jira.js'
import { llmRouter } from './routes/llm.js'
import { messagesRouter } from './routes/messages.js'
import { settingsRouter } from './routes/settings.js'
import { botRouter } from './routes/bot.js'
import { activityRouter } from './routes/activity.js'
import { todosRouter } from './routes/todos.js'
import { googleProxyRouter } from './routes/google-proxy.js'
import { gitlabRouter } from './routes/gitlab.js'
import { gitLocalRouter } from './routes/git-local.js'
import { prAgentRouter } from './routes/pr-agent.js'
import { documentsRouter } from './routes/documents.js'
import opencodeRouter from './routes/opencode.js'
import { voiceRouter } from './routes/voice.js'
import { initDb, initHeartbeat } from './bot/index.js'
import { getChannelManager } from './channels/manager.js'
import { TelegramAdapter } from './channels/telegram.js'
import { WhatsAppAdapter } from './channels/whatsapp.js'
import { GmailAdapter } from './channels/gmail.js'
import { handleMessage } from './agent/loop.js'
import { initTodosTable } from './mcp-server/tools/todos.js'
import { sendMorningBriefing, sendEveningRecap } from './proactive/briefing.js'
import { initCanvasWebSocket } from './canvas/renderer.js'

config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Request logging
app.use((req, res, next) => {
  const start = Date.now()
  const { method, url } = req
  res.on('finish', () => {
    const duration = Date.now() - start
    const status = res.statusCode
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'
    console.log(`[${level}] ${method} ${url} ${status} ${duration}ms`)
  })
  next()
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/jira', jiraRouter)
app.use('/api/llm', llmRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/bot', botRouter)
app.use('/api/activity', activityRouter)
app.use('/api/todos', todosRouter)
app.use('/api/google-proxy', googleProxyRouter)
app.use('/api/gitlab', gitlabRouter)
app.use('/api/git-local', gitLocalRouter)
app.use('/api/pr-agent', prAgentRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/opencode', opencodeRouter)
app.use('/api/voice', voiceRouter)

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] Unhandled: ${err.message}`)
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

const httpServer = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

initCanvasWebSocket(httpServer)

// Initialize databases
initDb()
initTodosTable()
initHeartbeat()

// Start channels
const channelManager = getChannelManager()
channelManager.onMessage(handleMessage)

if (process.env.TELEGRAM_BOT_TOKEN) {
  const allowedUsers = (process.env.TELEGRAM_ALLOWED_USERS || '')
    .split(',').map(s => s.trim()).filter(Boolean).map(Number)
  channelManager.register(new TelegramAdapter({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    allowedUsers,
  }))
}

// Register WhatsApp if configured
if (process.env.WHATSAPP_ENABLED === 'true') {
  channelManager.register(new WhatsAppAdapter({
    authDir: process.env.WHATSAPP_AUTH_DIR || './data/whatsapp-auth',
    allowedNumbers: process.env.WHATSAPP_ALLOWED_NUMBERS?.split(',').map(s => s.trim()).filter(Boolean),
  }))
}

// Register Gmail if configured
if (process.env.GMAIL_ENABLED === 'true') {
  channelManager.register(new GmailAdapter({
    credentialsPath: process.env.GMAIL_CREDENTIALS_PATH || './data/gmail-credentials.json',
    tokenPath: process.env.GMAIL_TOKEN_PATH || './data/gmail-token.json',
    pollIntervalMs: Number(process.env.GMAIL_POLL_INTERVAL_MS) || 300_000,
  }))
}

// Schedule briefings
if (process.env.DEFAULT_CHAT_ID) {
  cron.schedule(process.env.MORNING_BRIEFING_CRON || '0 8 * * 1-5', () => {
    sendMorningBriefing().catch(err => console.error('Morning briefing failed:', err))
  }, { timezone: 'Europe/Paris' })

  cron.schedule(process.env.EVENING_RECAP_CRON || '0 18 * * 1-5', () => {
    sendEveningRecap().catch(err => console.error('Evening recap failed:', err))
  }, { timezone: 'Europe/Paris' })

  console.log('Proactive briefings scheduled')
}

channelManager.startAll().catch(err => console.error('Channels failed to start:', err))
