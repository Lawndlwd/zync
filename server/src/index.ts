import express from 'express'
import cors from 'cors'
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
import { startBot, initDb, initHeartbeat } from './bot/index.js'
import { initTodosTable } from './mcp-server/tools/todos.js'

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

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] Unhandled: ${err.message}`)
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

// Initialize databases
initDb()
initTodosTable()
initHeartbeat()

// Start Telegram bot (runs concurrently with Express)
startBot().catch(err => console.error('Bot failed to start:', err))
