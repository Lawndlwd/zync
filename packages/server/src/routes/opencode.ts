import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { checkConnection, getProviderConfig, getOpenCodeUrl, getTokenStats, setActiveDashboardSession, getOrCreateSession } from '../opencode/client.js'
import { insertLLMCall, extractUsageFromSession } from '../bot/memory/activity.js'
import { getBrainDb as getDb } from '../memory/brain-db.js'

const opencodeRouter = Router()

opencodeRouter.get('/token-stats', async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined
    const stats = await getTokenStats(days)
    res.json(stats)
  } catch (err) {
    errorResponse(res, err)
  }
})

opencodeRouter.get('/providers', async (_req, res) => {
  try {
    const providers = await getProviderConfig()
    const models: string[] = []
    const result = providers.map((p) => {
      for (const m of p.models) models.push(m.id)
      return p
    })
    res.json({ providers: result, models })
  } catch (err) {
    errorResponse(res, err)
  }
})

opencodeRouter.get('/status', async (_req, res) => {
  try {
    const connected = await checkConnection()
    res.json({ connected, serverUrl: getOpenCodeUrl() })
  } catch {
    res.json({ connected: false, error: 'Cannot reach server' })
  }
})

// GET /chat-session — returns the backend's chat session ID for frontend sync
opencodeRouter.get('/chat-session', async (_req, res) => {
  try {
    const sessionId = await getOrCreateSession('chat')
    res.json({ sessionId })
  } catch (err) {
    errorResponse(res, err)
  }
})

opencodeRouter.put('/active-session', (req, res) => {
  const { sessionId } = req.body
  setActiveDashboardSession(sessionId || null)
  res.json({ ok: true })
})

// POST /log-usage — called by frontend after a prompt completes to log per-message token usage
opencodeRouter.post('/log-usage', async (req, res) => {
  try {
    const { sessionId } = req.body
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' })
      return
    }

    const usage = await extractUsageFromSession(sessionId)

    if (usage.total_tokens === 0) {
      res.json({ logged: false, reason: 'no token data yet' })
      return
    }

    // Dedup: skip if this message was already logged
    if (usage.message_id) {
      const existing = getDb().prepare('SELECT 1 FROM llm_calls WHERE message_id = ? LIMIT 1').get(usage.message_id)
      if (existing) {
        res.json({ logged: false, reason: 'already logged' })
        return
      }
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

    res.json({ logged: true, total_tokens: usage.total_tokens })
  } catch (err) {
    errorResponse(res, err)
  }
})

export default opencodeRouter
