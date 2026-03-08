import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { getDMs, getDMStats, updateDMReply } from '../telegram/db.js'
import { crossPostToTelegram } from '../telegram/crosspost.js'
import { reloadSupportPrompt } from '../telegram/support.js'
import { getConfig, getConfigService } from '../config/index.js'

export const telegramRouter = Router()

// --- DM Inbox ---

telegramRouter.get('/dms', (_req, res) => {
  try {
    const category = _req.query.category as string | undefined
    const limit = Number(_req.query.limit) || 50
    const offset = Number(_req.query.offset) || 0
    const dms = getDMs({ category, limit, offset })
    res.json({ dms })
  } catch (err) {
    errorResponse(res, err)
  }
})

telegramRouter.get('/dms/stats', (_req, res) => {
  try {
    const stats = getDMStats()
    res.json(stats)
  } catch (err) {
    errorResponse(res, err)
  }
})

telegramRouter.post('/dms/:id/reply', async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ error: 'text is required' })
    updateDMReply(Number(req.params.id), text)
    res.json({ ok: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Cross-posting ---

telegramRouter.post('/crosspost', async (req, res) => {
  try {
    const { content, mediaUrl } = req.body
    if (!content) return res.status(400).json({ error: 'content is required' })
    const result = await crossPostToTelegram(content, mediaUrl)
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Config ---

telegramRouter.get('/config', (_req, res) => {
  try {
    res.json({
      channelId: getConfig('TELEGRAM_CHANNEL_ID') || '',
      dmAutoReply: getConfig('TELEGRAM_DM_AUTO_REPLY') === 'true',
      supportRateLimit: Number(getConfig('TELEGRAM_SUPPORT_RATE_LIMIT', '5')) || 5,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

telegramRouter.put('/config', (req, res) => {
  try {
    const { channelId, dmAutoReply, supportRateLimit } = req.body
    const svc = getConfigService()
    if (!svc) return res.status(503).json({ error: 'Config service unavailable' })

    if (channelId !== undefined) svc.set('TELEGRAM_CHANNEL_ID', channelId, 'telegram')
    if (dmAutoReply !== undefined) svc.set('TELEGRAM_DM_AUTO_REPLY', String(dmAutoReply), 'telegram')
    if (supportRateLimit !== undefined) svc.set('TELEGRAM_SUPPORT_RATE_LIMIT', String(supportRateLimit), 'telegram')

    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Skill file reload ---

telegramRouter.post('/reload-prompt', (_req, res) => {
  try {
    reloadSupportPrompt()
    res.json({ ok: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
