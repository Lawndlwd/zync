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
import { projectsRouter } from './routes/projects.js'
import opencodeRouter from './routes/opencode.js'
import { voiceRouter } from './routes/voice.js'
import { canvasRouter } from './routes/canvas.js'
import { initDb, initHeartbeat } from './bot/index.js'
import { getChannelManager } from './channels/manager.js'
import { handleMessage } from './agent/loop.js'
import { initTodosTable } from './mcp-server/tools/todos.js'
import { sendMorningBriefing, sendEveningRecap } from './proactive/briefing.js'
import { initCanvasWebSocket } from './canvas/renderer.js'
import { startWakeWordServer, stopWakeWordServer } from './voice/wakeword.js'
import { WhatsAppAdapter } from './channels/whatsapp.js'
import { TelegramAdapter } from './channels/telegram.js'
import { loadChannelConfig } from './routes/bot.js'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { logger } from './lib/logger.js'

config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Request logging
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info({ method: req.method, url: req.url, status: res.statusCode, duration }, 'request')
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
app.use('/api/projects', projectsRouter)
app.use('/api/opencode', opencodeRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/canvas', canvasRouter)

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})

const httpServer = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
})

initCanvasWebSocket(httpServer)

// Start wake word sidecar (if enabled)
startWakeWordServer()

// Graceful shutdown
process.on('SIGTERM', () => stopWakeWordServer())
process.on('SIGINT', () => stopWakeWordServer())

// Initialize databases
initDb()
initTodosTable()
initHeartbeat()

// Initialize channel manager
const channelManager = getChannelManager()
channelManager.onMessage(handleMessage)

// Auto-reconnect channels that have saved auth state
;(async () => {
  const cfg = loadChannelConfig()

  // WhatsApp: reconnect if auth state exists
  const waAuthDir = process.env.WHATSAPP_AUTH_DIR || './data/whatsapp-auth'
  if (existsSync(resolve(waAuthDir, 'creds.json'))) {
    logger.info('WhatsApp: found saved auth, auto-reconnecting...')
    const allowedNumbers = (cfg.whatsapp?.allowedNumbers || '')
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`)
    const adapter = new WhatsAppAdapter({ authDir: waAuthDir, allowedNumbers: allowedNumbers.length > 0 ? allowedNumbers : undefined })
    channelManager.register(adapter)
    adapter.start().catch(err => logger.error({ err }, 'WhatsApp auto-reconnect failed'))
  }

  // Telegram: reconnect if bot token exists
  const telegramToken = cfg.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN
  if (telegramToken) {
    logger.info('Telegram: found saved token, auto-reconnecting...')
    const allowedUsers = (cfg.telegram?.allowedUsers || process.env.TELEGRAM_ALLOWED_USERS || '')
      .split(',').map(s => s.trim()).filter(Boolean).map(Number)
    const adapter = new TelegramAdapter({ botToken: telegramToken, allowedUsers })
    channelManager.register(adapter)
    adapter.start().catch(err => logger.error({ err }, 'Telegram auto-reconnect failed'))
  }

  // Gmail: no auto-polling — accessed on-demand via MCP tools and briefings
})()

// Schedule briefings
if (process.env.DEFAULT_CHAT_ID) {
  cron.schedule(process.env.MORNING_BRIEFING_CRON || '0 8 * * 1-5', () => {
    sendMorningBriefing().catch(err => logger.error({ err }, 'Morning briefing failed'))
  }, { timezone: 'Europe/Paris' })

  cron.schedule(process.env.EVENING_RECAP_CRON || '0 18 * * 1-5', () => {
    sendEveningRecap().catch(err => logger.error({ err }, 'Evening recap failed'))
  }, { timezone: 'Europe/Paris' })

  logger.info('Proactive briefings scheduled')
}

