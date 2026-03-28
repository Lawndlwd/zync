import { randomBytes } from 'node:crypto'
// Channel config now read from vault/config services (no JSON file)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import cors from 'cors'
import { config } from 'dotenv'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { handleMessage } from './agent/loop.js'
import { initDb, initHeartbeat } from './bot/index.js'
import { extractUsageFromSession, insertLLMCall } from './bot/memory/activity.js'
import { initCanvasWebSocket } from './canvas/renderer.js'
import { getChannelManager } from './channels/manager.js'
import { TelegramAdapter } from './channels/telegram.js'
import { WhatsAppAdapter } from './channels/whatsapp.js'
import { getConfig } from './config/index.js'
import { migrateJsonConfigs } from './config/migrate.js'
import { logger } from './lib/logger.js'
import { initTodosTable } from './mcp-server/tools/todos.js'
import { getBrainDb as getDb, initBrainDb } from './memory/brain-db.js'
import { migrateToBrain } from './memory/migrate-brain.js'
import { startUsageTracker } from './opencode/client.js'
import { startBreakerScheduler } from './planner/breaker-scheduler.js'
import { initPlannerDb } from './planner/db.js'
import { scheduleBriefings } from './proactive/briefing.js'
import { activityRouter } from './routes/activity.js'
import { botRouter } from './routes/bot.js'
import { canvasRouter } from './routes/canvas.js'
import configRouter from './routes/config.js'
import { documentsRouter } from './routes/documents.js'
import { llmRouter } from './routes/llm.js'
import { memoryRouter } from './routes/memory.js'
import opencodeRouter from './routes/opencode.js'
import { plannerRouter } from './routes/planner.js'
import { projectsRouter } from './routes/projects.js'
import { secretsRouter } from './routes/secrets.js'
import { settingsRouter } from './routes/settings.js'
import { setupRouter } from './routes/setup.js'
import { telegramRouter } from './routes/telegram.js'
import { todosRouter } from './routes/todos.js'
import { voiceRouter } from './routes/voice.js'
import { widgetsRouter } from './routes/widgets.js'
import { getSecret } from './secrets/index.js'
import { initTelegramDb } from './telegram/db.js'
import { startWakeWordServer, stopWakeWordServer } from './voice/wakeword.js'
import { initWidgetsDb } from './widgets/db.js'
import { scheduleWidgetRefresh } from './widgets/scheduler.js'

config()

// Default DOCUMENTS_PATH to data/documents relative to server root
if (!process.env.DOCUMENTS_PATH) {
  process.env.DOCUMENTS_PATH = resolve(import.meta.dirname, '../../../data/documents')
}

// Read version from package.json
const require = createRequire(import.meta.url)
const pkg = require('../package.json')
const APP_VERSION: string = pkg.version || '0.0.0'

// Auto-generate SECRET_KEY if not set
if (!process.env.SECRET_KEY) {
  const secretKeyPath = resolve('data/.secret-key')
  if (existsSync(secretKeyPath)) {
    process.env.SECRET_KEY = readFileSync(secretKeyPath, 'utf-8').trim()
    logger.info('SECRET_KEY loaded from data/.secret-key')
  } else {
    const generated = randomBytes(32).toString('hex')
    process.env.SECRET_KEY = generated
    mkdirSync(dirname(secretKeyPath), { recursive: true })
    writeFileSync(secretKeyPath, generated, { mode: 0o600 })
    logger.info('SECRET_KEY auto-generated and saved to data/.secret-key')
  }
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
  res.json({ status: 'ok', version: APP_VERSION, timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/llm', llmRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/bot', botRouter)
app.use('/api/activity', activityRouter)
app.use('/api/todos', todosRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/opencode', opencodeRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/canvas', canvasRouter)
app.use('/api/secrets', secretsRouter)
app.use('/api/config', configRouter)
app.use('/api/setup', setupRouter)
app.use('/api/telegram', telegramRouter)
app.use('/api/widgets', widgetsRouter)
app.use('/api/memory', memoryRouter)
app.use('/api/planner', plannerRouter)

// Proxy /opencode/* to the OpenCode server (strips the /opencode prefix)
const opencodeUrl = getConfig('OPENCODE_URL', 'http://localhost:4096') || 'http://localhost:4096'
app.use(
  '/opencode',
  createProxyMiddleware({
    target: opencodeUrl,
    changeOrigin: true,
    pathRewrite: { '^/opencode': '' },
    ws: true,
  }),
)

// In production, serve the built React frontend
if (process.env.NODE_ENV === 'production') {
  const clientDist = resolve(import.meta.dirname, '../../app/dist')
  app.use(express.static(clientDist))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(resolve(clientDist, 'index.html'))
  })
}

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})

const httpServer = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
})

initCanvasWebSocket(httpServer as import('node:http').Server)

// Start wake word sidecar (if enabled)
startWakeWordServer()

// Graceful shutdown
process.on('SIGTERM', () => stopWakeWordServer())
process.on('SIGINT', () => stopWakeWordServer())

// Initialize databases
initDb()
initBrainDb()
migrateToBrain()
initTodosTable()
initHeartbeat()
initTelegramDb()
initWidgetsDb()
initPlannerDb()
startBreakerScheduler()
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
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => (n.includes('@') ? n : `${n}@s.whatsapp.net`))
    const adapter = new WhatsAppAdapter({
      authDir: waAuthDir,
      allowedNumbers: allowedNumbers.length > 0 ? allowedNumbers : undefined,
    })
    channelManager.register(adapter)
    adapter.start().catch((err) => logger.error({ err }, 'WhatsApp auto-reconnect failed'))
  }

  // Telegram: reconnect if bot token exists
  const telegramToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN')
  if (telegramToken) {
    logger.info('Telegram: found saved token, auto-reconnecting...')
    const allowedUsers = (getConfig('TELEGRAM_ALLOWED_USERS') || getSecret('TELEGRAM_ALLOWED_USERS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
    const adapter = new TelegramAdapter({ botToken: telegramToken, allowedUsers })
    channelManager.register(adapter)
    adapter.start().catch((err) => logger.error({ err }, 'Telegram auto-reconnect failed'))
  }

  // Gmail: no auto-polling — accessed on-demand via MCP tools and briefings
})()

// Schedule briefings (reads config; re-called from PUT /briefing/config)
scheduleBriefings()

// Schedule widget refresh
scheduleWidgetRefresh()

// Server-side usage tracking — logs token usage for all OpenCode sessions (chat, bot, etc.)
startUsageTracker(async (sessionId) => {
  try {
    const usage = await extractUsageFromSession(sessionId)
    if (usage.total_tokens === 0) return
    if (usage.message_id) {
      const existing = getDb().prepare('SELECT 1 FROM llm_calls WHERE message_id = ? LIMIT 1').get(usage.message_id)
      if (existing) return
    }
    insertLLMCall({
      source: 'chat',
      model: usage.model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      tool_names: [],
      duration_ms: 0,
      session_id: sessionId,
      message_id: usage.message_id,
      cost: usage.cost,
    })
  } catch {
    // ignore
  }
})
