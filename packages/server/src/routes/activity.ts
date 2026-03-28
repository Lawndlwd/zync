import { Router } from 'express'
import { getActivityStats, getRecentCalls, insertOpenCodeSession, isSessionSynced } from '../bot/memory/activity.js'
import { errorResponse } from '../lib/errors.js'
import * as opencode from '../opencode/client.js'

export const activityRouter = Router()

activityRouter.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  res.json(getRecentCalls(limit, offset))
})

activityRouter.get('/stats', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)
  res.json(getActivityStats(days))
})

activityRouter.post('/sync-opencode', async (_req, res) => {
  try {
    const connected = await opencode.checkConnection()
    if (!connected) {
      return res.json({ synced: 0, message: 'OpenCode not reachable' })
    }

    const sessionsRes = await fetch(`${opencode.getOpenCodeUrl()}/session`)
    if (!sessionsRes.ok) {
      return res.json({ synced: 0, message: 'Failed to fetch sessions' })
    }
    const sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string }> =
      await sessionsRes.json()

    let synced = 0
    for (const session of sessions) {
      if (isSessionSynced(session.id)) continue

      const messages = await opencode.getSessionMessages(session.id)

      let promptTokens = 0,
        completionTokens = 0,
        cost = 0
      const models = new Set<string>()

      for (const msg of messages) {
        const info = msg.info || msg
        if (info.tokens) {
          promptTokens += (info.tokens.input || 0) + (info.tokens.cache?.read || 0) + (info.tokens.cache?.write || 0)
          completionTokens += (info.tokens.output || 0) + (info.tokens.reasoning || 0)
        }
        if (info.cost) cost += info.cost
        if (info.modelID) models.add(info.modelID)
      }

      const totalTokens = promptTokens + completionTokens
      if (totalTokens === 0) continue

      const isDashboard = (session.title || '').startsWith('[dashboard]')
      insertOpenCodeSession({
        sessionId: session.id,
        source: isDashboard ? 'dashboard' : 'opencode',
        model: Array.from(models)[0] || 'unknown',
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        createdAt: session.createdAt,
      })
      synced++
    }

    res.json({ synced })
  } catch (err) {
    errorResponse(res, err)
  }
})
