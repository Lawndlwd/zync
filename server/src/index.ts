import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { config } from 'dotenv'
import { jiraRouter } from './routes/jira.js'
import { llmRouter } from './routes/llm.js'
import { settingsRouter } from './routes/settings.js'
import { botRouter } from './routes/bot.js'
import { activityRouter } from './routes/activity.js'
import { todosRouter } from './routes/todos.js'
import { gitlabRouter } from './routes/gitlab.js'
import { gitLocalRouter } from './routes/git-local.js'
import { prAgentRouter } from './routes/pr-agent.js'
import { documentsRouter } from './routes/documents.js'
import { projectsRouter } from './routes/projects.js'
import opencodeRouter from './routes/opencode.js'
import { voiceRouter } from './routes/voice.js'
import { canvasRouter } from './routes/canvas.js'
import { secretsRouter } from './routes/secrets.js'
import configRouter from './routes/config.js'
import { setupRouter } from './routes/setup.js'
import { initDb, initHeartbeat } from './bot/index.js'
import { getChannelManager } from './channels/manager.js'
import { handleMessage } from './agent/loop.js'
import { initTodosTable } from './mcp-server/tools/todos.js'
import { sendMorningBriefing, sendEveningRecap } from './proactive/briefing.js'
import { initCanvasWebSocket } from './canvas/renderer.js'
import { startWakeWordServer, stopWakeWordServer } from './voice/wakeword.js'
import { WhatsAppAdapter } from './channels/whatsapp.js'
import { TelegramAdapter } from './channels/telegram.js'
// Channel config now read from vault/config services (no JSON file)
import { existsSync } from 'fs'
import { resolve } from 'path'
import { logger } from './lib/logger.js'
import { getSecret } from './secrets/index.js'
import { getConfig } from './config/index.js'
import { migrateJsonConfigs } from './config/migrate.js'

config()

if (!process.env.SECRET_KEY) {
  logger.warn('SECRET_KEY not set — secrets vault disabled. Generate with: openssl rand -hex 32')
}

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
app.use('/api/settings', settingsRouter)
app.use('/api/bot', botRouter)
app.use('/api/activity', activityRouter)
app.use('/api/todos', todosRouter)
app.use('/api/gitlab', gitlabRouter)
app.use('/api/git-local', gitLocalRouter)
app.use('/api/pr-agent', prAgentRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/opencode', opencodeRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/canvas', canvasRouter)
app.use('/api/secrets', secretsRouter)
app.use('/api/config', configRouter)
app.use('/api/setup', setupRouter)

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
migrateJsonConfigs()

// Initialize channel manager
const channelManager = getChannelManager()
channelManager.onMessage(handleMessage)

// Auto-reconnect channels that have saved auth state
;(async () => {
  // WhatsApp: reconnect if auth state exists
  const waAuthDir = getConfig('WHATSAPP_AUTH_DIR', './data/whatsapp-auth') || './data/whatsapp-auth'
  if (existsSync(resolve(waAuthDir, 'creds.json'))) {
    logger.info('WhatsApp: found saved auth, auto-reconnecting...')
    const allowedNumbers = (getConfig('WHATSAPP_ALLOWED_NUMBERS') || '')
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`)
    const adapter = new WhatsAppAdapter({ authDir: waAuthDir, allowedNumbers: allowedNumbers.length > 0 ? allowedNumbers : undefined })
    channelManager.register(adapter)
    adapter.start().catch(err => logger.error({ err }, 'WhatsApp auto-reconnect failed'))
  }

  // Telegram: reconnect if bot token exists
  const telegramToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN')
  if (telegramToken) {
    logger.info('Telegram: found saved token, auto-reconnecting...')
    const allowedUsers = (getConfig('TELEGRAM_ALLOWED_USERS') || getSecret('TELEGRAM_ALLOWED_USERS') || '')
      .split(',').map(s => s.trim()).filter(Boolean).map(Number)
    const adapter = new TelegramAdapter({ botToken: telegramToken, allowedUsers })
    channelManager.register(adapter)
    adapter.start().catch(err => logger.error({ err }, 'Telegram auto-reconnect failed'))
  }

  // Gmail: no auto-polling — accessed on-demand via MCP tools and briefings
})()

// Schedule briefings
if (getConfig('DEFAULT_CHAT_ID')) {
  cron.schedule(getConfig('MORNING_BRIEFING_CRON', '0 8 * * 1-5') || '0 8 * * 1-5', () => {
    sendMorningBriefing().catch(err => logger.error({ err }, 'Morning briefing failed'))
  }, { timezone: getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris' })

  cron.schedule(getConfig('EVENING_RECAP_CRON', '0 18 * * 1-5') || '0 18 * * 1-5', () => {
    sendEveningRecap().catch(err => logger.error({ err }, 'Evening recap failed'))
  }, { timezone: getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris' })

  logger.info('Proactive briefings scheduled')
}

