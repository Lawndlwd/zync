import { Router } from 'express'
import { checkConnection, getProviderConfig, getOpenCodeUrl, getTokenStats } from '../opencode/client.js'

const opencodeRouter = Router()

opencodeRouter.get('/token-stats', async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined
    const stats = await getTokenStats(days)
    res.json(stats)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
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
  } catch (err: any) {
    res.status(500).json({ error: err.message })
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

export default opencodeRouter
