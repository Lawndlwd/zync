import { Router } from 'express'
import { Bot } from 'grammy'
import { errorResponse } from '../lib/errors.js'
import { getDMs, getDMStats, updateDMReply } from '../telegram/db.js'
import { crossPostToTelegram } from '../telegram/crosspost.js'
import { fetchTelegramChannelPosts } from '../telegram/analytics.js'
import { reloadSupportPrompt } from '../telegram/support.js'
import { getConfig, getConfigService } from '../config/index.js'
import { getSecret } from '../secrets/index.js'

export const telegramRouter = Router()

// --- DM Inbox ---

telegramRouter.get('/dms', (_req, res) => {
  try {
    const category = _req.query.category as string | undefined
    const limit = Math.min(Number(_req.query.limit) || 50, 200)
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
    // TODO: Actually send the reply via Telegram. This requires access to the
    // bot instance (and business_connection_id for business-mode DMs).
    // For now we only persist the reply text in the DB.
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

telegramRouter.get('/config', async (_req, res) => {
  try {
    const channelId = getConfig('TELEGRAM_CHANNEL_ID') || ''
    const result: Record<string, unknown> = {
      channelId,
      dmAutoReply: getConfig('TELEGRAM_DM_AUTO_REPLY') === 'true',
      supportRateLimit: Number(getConfig('TELEGRAM_SUPPORT_RATE_LIMIT', '5')) || 5,
    }

    // If channel is configured, try to fetch live info
    if (channelId) {
      const botToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN')
      if (botToken) {
        try {
          const bot = new Bot(botToken)
          const chat = await bot.api.getChat(channelId)
          const memberCount = await bot.api.getChatMemberCount(channelId)
          result.channel = {
            title: ('title' in chat ? chat.title : undefined) ?? 'Telegram Channel',
            memberCount,
            channelId,
          }
        } catch { /* channel info unavailable, return config without it */ }
      }
    }

    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

telegramRouter.put('/config', async (req, res) => {
  try {
    const { channelId, dmAutoReply, supportRateLimit } = req.body
    const svc = getConfigService()
    if (!svc) return res.status(503).json({ error: 'Config service unavailable' })

    if (dmAutoReply !== undefined) svc.set('TELEGRAM_DM_AUTO_REPLY', String(dmAutoReply), 'telegram')
    if (supportRateLimit !== undefined) svc.set('TELEGRAM_SUPPORT_RATE_LIMIT', String(supportRateLimit), 'telegram')

    // If channel ID is being set, verify it and fetch channel info
    if (channelId !== undefined) {
      svc.set('TELEGRAM_CHANNEL_ID', channelId, 'telegram')

      if (channelId) {
        const botToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN')
        if (!botToken) {
          return res.status(400).json({ error: 'No Telegram bot token configured. Set it up in Channels settings first.' })
        }
        try {
          const bot = new Bot(botToken)
          const chat = await bot.api.getChat(channelId)
          const memberCount = await bot.api.getChatMemberCount(channelId)
          const title = ('title' in chat ? chat.title : undefined) ?? 'Telegram Channel'

          // Register as social account immediately
          await fetchTelegramChannelPosts()

          res.json({
            success: true,
            channel: { title, memberCount, channelId },
          })
          return
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          return res.status(400).json({ error: `Could not reach channel: ${msg}. Make sure the bot is an admin.` })
        }
      }
    }

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
