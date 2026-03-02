import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import {
  GmailReplySchema,
  BriefingTriggerSchema,
  MemoryCreateSchema,
  ScheduleCreateSchema,
  BotChatSchema,
  TelegramConfigSchema,
  WhatsAppConfigSchema,
  GmailConfigSchema,
} from '../lib/schemas.js'
import { getSecret } from '../secrets/index.js'
import { getConfig } from '../config/index.js'
import { searchMemory, saveMemory, deleteMemory, listAllMemories, getMemoryCount } from '../bot/memory/index.js'
import { getAllSchedules } from '../bot/heartbeat/db.js'
import { addSchedule, adminRemoveSchedule, adminToggleSchedule } from '../bot/heartbeat/scheduler.js'
import { getOrCreateSession, sendPromptAsync, getSessionMessages } from '../opencode/client.js'
import { getChannelManager } from '../channels/manager.js'
import { TelegramAdapter } from '../channels/telegram.js'
import { WhatsAppAdapter } from '../channels/whatsapp.js'
import { loadSkills, reloadSkills } from '../skills/loader.js'
import { sendMorningBriefing, sendEveningRecap } from '../proactive/briefing.js'
import { getRecommendations } from '../proactive/recommendations.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import type { ChannelType } from '../channels/types.js'
import { logger } from '../lib/logger.js'

const DATA_DIR = resolve(import.meta.dirname, '../../data')
const CHANNEL_CONFIG_PATH = resolve(DATA_DIR, 'channel-config.json')

interface ChannelConfigData {
  telegram?: { botToken: string; allowedUsers: string }
  whatsapp?: { allowedNumbers: string; autoReply?: boolean; autoReplyInstructions?: string }
  gmail?: { clientId: string; clientSecret: string; refreshToken: string }
}

export function loadChannelConfig(): ChannelConfigData {
  if (existsSync(CHANNEL_CONFIG_PATH)) {
    return JSON.parse(readFileSync(CHANNEL_CONFIG_PATH, 'utf-8'))
  }
  return {}
}

function saveChannelConfig(cfg: ChannelConfigData): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CHANNEL_CONFIG_PATH, JSON.stringify(cfg, null, 2))
}

const OAUTH_BASE_URL = getConfig('OAUTH_BASE_URL') || `http://localhost:${process.env.PORT || 3001}`
const FRONTEND_BASE_URL = getConfig('FRONTEND_BASE_URL') || `http://localhost:${getConfig('FRONTEND_PORT', '5173') || '5173'}`

export const botRouter = Router()

// GET /api/bot/status
botRouter.get('/status', async (_req, res) => {
  try {
    const memoryCount = getMemoryCount()
    const schedules = getAllSchedules()
    const activeSchedules = schedules.filter((s: any) => s.enabled === 1).length

    const channels = getChannelManager().getRegisteredChannels()
    let skillsCount = 0
    try { skillsCount = loadSkills().length } catch {}

    let briefingEnabled = false
    try {
      const cfgPath = resolve(DATA_DIR, 'briefing-config.json')
      if (existsSync(cfgPath)) {
        briefingEnabled = JSON.parse(readFileSync(cfgPath, 'utf-8')).enabled ?? false
      } else {
        briefingEnabled = !!(getConfig('MORNING_CRON') || getConfig('EVENING_CRON'))
      }
    } catch {}

    res.json({
      memoryCount,
      toolCount: 32,
      activeSchedules,
      totalSchedules: schedules.length,
      modelName: 'opencode',
      providerName: 'OpenCode',
      isLocal: false,
      channels,
      skillsCount,
      briefingEnabled,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/channels — status of all channels
botRouter.get('/channels', (_req, res) => {
  try {
    const registered = getChannelManager().getRegisteredChannels()
    const cfg = loadChannelConfig()

    const channels: ChannelType[] = ['telegram', 'whatsapp', 'gmail']
    const result = channels.map((channel) => {
      let configured = false
      if (channel === 'telegram') configured = !!cfg.telegram?.botToken
      if (channel === 'whatsapp') configured = !!cfg.whatsapp
      if (channel === 'gmail') configured = !!(cfg.gmail?.clientId && cfg.gmail?.clientSecret && cfg.gmail?.refreshToken)

      const adapter = getChannelManager().getAdapter(channel)
      let connectionState = 'disconnected'
      if (channel === 'gmail') {
        connectionState = configured ? 'connected' : 'disconnected'
      } else if (channel === 'whatsapp' && adapter && 'connectionState' in adapter) {
        connectionState = (adapter as WhatsAppAdapter).connectionState
      } else if (registered.includes(channel)) {
        connectionState = 'connected'
      }

      // For WhatsApp, only report connected when actually authenticated (not just registered)
      // For Gmail, connected = credentials exist (on-demand, no polling adapter)
      const connected = channel === 'gmail'
        ? configured
        : channel === 'whatsapp'
          ? connectionState === 'connected'
          : registered.includes(channel)

      return { channel, connected, configured, connectionState }
    })

    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/channels/config — saved channel configuration (tokens masked)
botRouter.get('/channels/config', (_req, res) => {
  try {
    const cfg = loadChannelConfig()
    // Mask secrets
    const masked: any = {}
    if (cfg.telegram) {
      masked.telegram = {
        botToken: cfg.telegram.botToken ? '••••' + cfg.telegram.botToken.slice(-6) : '',
        allowedUsers: cfg.telegram.allowedUsers || '',
        hasBotToken: !!cfg.telegram.botToken,
      }
    }
    if (cfg.whatsapp) {
      masked.whatsapp = {
        allowedNumbers: cfg.whatsapp.allowedNumbers || '',
        autoReply: cfg.whatsapp.autoReply ?? false,
        autoReplyInstructions: cfg.whatsapp.autoReplyInstructions || '',
      }
    }
    if (cfg.gmail) {
      masked.gmail = {
        clientId: cfg.gmail.clientId || '',
        hasClientSecret: !!cfg.gmail.clientSecret,
        authorized: !!cfg.gmail.refreshToken,
        mode: 'on-demand',
      }
    }
    res.json(masked)
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/bot/channels/config/:channel — save config for one channel
botRouter.put('/channels/config/:channel', (req, res) => {
  try {
    const channel = req.params.channel as ChannelType
    const cfg = loadChannelConfig()

    let schema: z.ZodType
    if (channel === 'telegram') schema = TelegramConfigSchema
    else if (channel === 'whatsapp') schema = WhatsAppConfigSchema
    else if (channel === 'gmail') schema = GmailConfigSchema
    else return res.status(400).json({ error: 'Unknown channel' })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })

    if (channel === 'telegram') {
      const { botToken, allowedUsers } = parsed.data as z.infer<typeof TelegramConfigSchema>
      cfg.telegram = { botToken: botToken || cfg.telegram?.botToken || '', allowedUsers: allowedUsers ?? '' }
    } else if (channel === 'whatsapp') {
      const { allowedNumbers, autoReply, autoReplyInstructions } = parsed.data as z.infer<typeof WhatsAppConfigSchema>
      cfg.whatsapp = {
        allowedNumbers: allowedNumbers ?? cfg.whatsapp?.allowedNumbers ?? '',
        autoReply: autoReply ?? cfg.whatsapp?.autoReply ?? false,
        autoReplyInstructions: autoReplyInstructions ?? cfg.whatsapp?.autoReplyInstructions ?? '',
      }
    } else if (channel === 'gmail') {
      const { clientId, clientSecret, refreshToken } = parsed.data as z.infer<typeof GmailConfigSchema>
      cfg.gmail = {
        clientId: clientId || cfg.gmail?.clientId || '',
        clientSecret: clientSecret || cfg.gmail?.clientSecret || '',
        refreshToken: refreshToken || cfg.gmail?.refreshToken || '',
      }
    }

    saveChannelConfig(cfg)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/channels/gmail/auth-url — get Google OAuth consent URL
botRouter.get('/channels/gmail/auth-url', (_req, res) => {
  try {
    const cfg = loadChannelConfig()
    const clientId = cfg.gmail?.clientId
    if (!clientId) {
      return res.status(400).json({ error: 'Save Client ID and Client Secret first.' })
    }
    const redirectUri = `${OAUTH_BASE_URL}/api/bot/channels/gmail/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline',
      prompt: 'consent',
    })
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/channels/gmail/callback — OAuth callback, exchanges code for tokens
botRouter.get('/channels/gmail/callback', async (req, res) => {
  try {
    const error = req.query.error as string | undefined
    if (error) {
      return res.redirect(`${FRONTEND_BASE_URL}/settings?gmail_error=${encodeURIComponent(error)}`)
    }
    const code = req.query.code as string
    if (!code) return res.redirect(`${FRONTEND_BASE_URL}/settings?gmail_error=no_code`)

    const cfg = loadChannelConfig()
    const clientId = cfg.gmail?.clientId
    const clientSecret = cfg.gmail?.clientSecret
    if (!clientId || !clientSecret) {
      return res.status(400).send('Gmail Client ID/Secret not configured')
    }

    const redirectUri = `${OAUTH_BASE_URL}/api/bot/channels/gmail/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return res.status(400).send(`Token exchange failed: ${text}`)
    }

    const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number }
    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh token received. Try revoking access at myaccount.google.com/permissions and retry.')
    }

    // Save refresh token to config
    cfg.gmail = {
      ...cfg.gmail!,
      refreshToken: tokens.refresh_token,
    }
    saveChannelConfig(cfg)

    // Gmail is accessed on-demand via MCP tools — no polling adapter needed
    logger.info('Gmail: OAuth tokens saved, available for on-demand access')

    // Redirect back to settings page with success
    res.redirect(`${FRONTEND_BASE_URL}/settings?gmail=authorized`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).send(`OAuth error: ${message}`)
  }
})

// POST /api/bot/channels/:channel/connect — start a channel adapter
botRouter.post('/channels/:channel/connect', async (req, res) => {
  try {
    const channel = req.params.channel as ChannelType
    const manager = getChannelManager()
    const cfg = loadChannelConfig()

    // Disconnect existing if running
    await manager.unregister(channel)

    if (channel === 'telegram') {
      const botToken = cfg.telegram?.botToken || getSecret('TELEGRAM_BOT_TOKEN')
      if (!botToken) return res.status(400).json({ error: 'No bot token configured. Save a token first.' })
      const allowedUsers = (cfg.telegram?.allowedUsers || getSecret('TELEGRAM_ALLOWED_USERS') || '')
        .split(',').map(s => s.trim()).filter(Boolean).map(Number)
      const adapter = new TelegramAdapter({ botToken, allowedUsers })
      manager.register(adapter)

      await adapter.start()
    } else if (channel === 'whatsapp') {
      const authDir = getConfig('WHATSAPP_AUTH_DIR', './data/whatsapp-auth') || './data/whatsapp-auth'
      const allowedNumbers = (cfg.whatsapp?.allowedNumbers || '')
        .split(',').map(s => s.trim()).filter(Boolean)
        .map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`)
      const adapter = new WhatsAppAdapter({ authDir, allowedNumbers: allowedNumbers.length > 0 ? allowedNumbers : undefined })
      manager.register(adapter)

      await adapter.start()
    } else if (channel === 'gmail') {
      // Gmail is on-demand only (MCP tools + briefings), no polling adapter
      return res.json({ success: true, message: 'Gmail works on-demand — no polling adapter needed.' })
    } else {
      return res.status(400).json({ error: `Unknown channel: ${channel}` })
    }

    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/channels/:channel/disconnect — stop a channel adapter
botRouter.post('/channels/:channel/disconnect', async (req, res) => {
  try {
    const channel = req.params.channel as ChannelType
    await getChannelManager().unregister(channel)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/channels/gmail/reply — send a reply via Gmail API (kept as backend utility)
botRouter.post('/channels/gmail/reply', validate(GmailReplySchema), async (req, res) => {
  try {
    const { threadId, to, subject, body, messageId } = req.body

    const cfg = loadChannelConfig()
    if (!cfg.gmail?.refreshToken) {
      return res.status(400).json({ error: 'Gmail not configured' })
    }

    const { google } = await import('googleapis')
    const auth = new google.auth.OAuth2(cfg.gmail.clientId, cfg.gmail.clientSecret)
    auth.setCredentials({ refresh_token: cfg.gmail.refreshToken })
    const gmail = google.gmail({ version: 'v1', auth })

    const headers = [
      `To: ${to}`,
      `Subject: ${subject || 'Re:'}`,
      'Content-Type: text/plain; charset=utf-8',
    ]
    if (messageId) {
      headers.push(`In-Reply-To: ${messageId}`)
      headers.push(`References: ${messageId}`)
    }

    const raw = [...headers, '', body].join('\n')
    const encoded = Buffer.from(raw).toString('base64url')

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, threadId },
    })

    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'Gmail reply error')
    errorResponse(res, err)
  }
})

// GET /api/bot/channels/whatsapp/qr — get current WhatsApp QR code as data URL
botRouter.get('/channels/whatsapp/qr', (_req, res) => {
  try {
    const adapter = getChannelManager().getAdapter('whatsapp')
    if (!adapter || !('qrDataUrl' in adapter)) {
      return res.json({ qr: null, state: 'disconnected', error: null })
    }
    const wa = adapter as WhatsAppAdapter
    res.json({ qr: wa.qrDataUrl, state: wa.connectionState, error: wa.lastError })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/channels/whatsapp/reset — clear auth and force fresh pairing
botRouter.post('/channels/whatsapp/reset', async (_req, res) => {
  try {
    const manager = getChannelManager()
    await manager.unregister('whatsapp')
    const adapter = new WhatsAppAdapter({
      authDir: getConfig('WHATSAPP_AUTH_DIR', './data/whatsapp-auth') || './data/whatsapp-auth',
    })
    adapter.clearAuth()
    res.json({ success: true, message: 'WhatsApp auth cleared. Click Connect to pair again.' })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/skills
botRouter.get('/skills', (_req, res) => {
  try {
    const skills = loadSkills()
    res.json(skills.map(s => ({
      name: s.name,
      description: s.description,
      triggers: s.triggers,
    })))
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/skills/reload
botRouter.post('/skills/reload', (_req, res) => {
  try {
    const skills = reloadSkills()
    res.json({ count: skills.length })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/briefing/config
botRouter.get('/briefing/config', (_req, res) => {
  try {
    const cfgPath = resolve(DATA_DIR, 'briefing-config.json')
    if (existsSync(cfgPath)) {
      res.json(JSON.parse(readFileSync(cfgPath, 'utf-8')))
    } else {
      res.json({
        morningCron: getConfig('MORNING_CRON', '0 8 * * 1-5') || '0 8 * * 1-5',
        eveningCron: getConfig('EVENING_CRON', '0 18 * * 1-5') || '0 18 * * 1-5',
        channel: getConfig('DEFAULT_CHANNEL', 'telegram') || 'telegram',
        chatId: getConfig('DEFAULT_CHAT_ID') || '',
        enabled: !!(getConfig('MORNING_CRON') || getConfig('EVENING_CRON')),
      })
    }
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/bot/briefing/config
const BriefingConfigSchema = z.object({
  morningCron: z.string(),
  eveningCron: z.string(),
  channel: z.string(),
  chatId: z.string(),
  enabled: z.boolean(),
})

botRouter.put('/briefing/config', (req, res) => {
  try {
    const result = BriefingConfigSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.flatten() })
    }
    const cfgPath = resolve(DATA_DIR, 'briefing-config.json')
    writeFileSync(cfgPath, JSON.stringify(result.data, null, 2))
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/briefing/trigger
botRouter.post('/briefing/trigger', validate(BriefingTriggerSchema), async (req, res) => {
  try {
    const { type } = req.body
    if (type === 'morning') {
      await sendMorningBriefing()
    } else {
      await sendEveningRecap()
    }
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/tool-config
botRouter.get('/tool-config', (_req, res) => {
  try {
    const cfgPath = resolve(DATA_DIR, 'tool-config.json')
    if (existsSync(cfgPath)) {
      res.json(JSON.parse(readFileSync(cfgPath, 'utf-8')))
    } else {
      res.json({
        shell: { allowlist: [], timeout_ms: 30000, max_output_bytes: 100000 },
        files: { allowed_paths: ['./data'], max_file_size_bytes: 10485760 },
      })
    }
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/bot/tool-config
const ToolConfigSchema = z.object({
  shell: z.object({
    allowlist: z.array(z.string()),
    timeout_ms: z.number().optional(),
    max_output_bytes: z.number().optional(),
  }).optional(),
  files: z.object({
    allowed_paths: z.array(z.string()),
    max_file_size_bytes: z.number().optional(),
  }).optional(),
})

botRouter.put('/tool-config', (req, res) => {
  try {
    const result = ToolConfigSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.flatten() })
    }
    const cfgPath = resolve(DATA_DIR, 'tool-config.json')
    writeFileSync(cfgPath, JSON.stringify(result.data, null, 2))
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/recommendations
botRouter.get('/recommendations', (_req, res) => {
  try {
    const recs = getRecommendations()
    res.json(recs)
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/memories?q=&limit=50
botRouter.get('/memories', (req, res) => {
  try {
    const query = req.query.q as string | undefined
    const limit = parseInt(req.query.limit as string) || 50

    if (query && query.trim()) {
      const results = searchMemory(query.trim(), limit)
      res.json(results)
    } else {
      const results = listAllMemories(limit)
      res.json(results)
    }
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/memories
botRouter.post('/memories', validate(MemoryCreateSchema), (req, res) => {
  try {
    const { content, category } = req.body
    const result = saveMemory(content, category || 'general')
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/bot/memories/:id
botRouter.delete('/memories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const success = deleteMemory(id)
    res.json({ success })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/schedules
botRouter.get('/schedules', (_req, res) => {
  try {
    const schedules = getAllSchedules()
    res.json(schedules)
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/bot/schedules
botRouter.post('/schedules', validate(ScheduleCreateSchema), (req, res) => {
  try {
    const { cron_expression, prompt, chat_id } = req.body
    const schedule = addSchedule(Number(chat_id), cron_expression, prompt)
    res.json(schedule)
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/bot/schedules/:id
botRouter.delete('/schedules/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const success = adminRemoveSchedule(id)
    res.json({ success })
  } catch (err) {
    errorResponse(res, err)
  }
})

// PATCH /api/bot/schedules/:id
botRouter.patch('/schedules/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { enabled } = req.body
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' })
    }
    const success = adminToggleSchedule(id, enabled)
    res.json({ success })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/bot/tools — real tool registry
botRouter.get('/tools', async (_req, res) => {
  const tools = [
    { name: 'create_todo', description: 'Create a personal to-do item' },
    { name: 'mark_todo_done', description: 'Mark a personal to-do as done' },
    { name: 'list_todos', description: 'List all personal to-do items' },
    { name: 'update_todo', description: 'Update a personal to-do item' },
    { name: 'delete_todo', description: 'Delete a personal to-do item by ID' },
    { name: 'save_memory', description: 'Save information to long-term memory' },
    { name: 'search_memory', description: 'Search long-term memory' },
    { name: 'delete_memory', description: 'Delete a specific memory by ID' },
    { name: 'create_schedule', description: 'Create a recurring scheduled task' },
    { name: 'list_schedules', description: 'List all scheduled tasks' },
    { name: 'delete_schedule', description: 'Delete a scheduled task by ID' },
    { name: 'toggle_schedule', description: 'Enable or disable a scheduled task' },
    { name: 'list_documents', description: 'List documents from the knowledge base' },
    { name: 'get_document', description: 'Read a document from the knowledge base' },
    { name: 'create_document', description: 'Create a new document' },
    { name: 'update_document', description: 'Update a document in the knowledge base' },
    { name: 'run_shell', description: 'Execute a shell command (restricted to allowlist)' },
    { name: 'read_file', description: 'Read a file from allowed paths' },
    { name: 'write_file', description: 'Write content to a file in allowed paths' },
    { name: 'delete_file', description: 'Delete a file from allowed paths' },
    { name: 'list_files', description: 'List files in a directory' },
    { name: 'search_files', description: 'Search for files matching a regex pattern' },
    { name: 'web_search', description: 'Search the web using DuckDuckGo' },
    { name: 'browse', description: 'Navigate to a URL and extract page content' },
    { name: 'screenshot', description: 'Take a screenshot of a URL' },
    { name: 'render_canvas', description: 'Render HTML/CSS/JS in the live canvas' },
    { name: 'clear_canvas', description: 'Clear the live canvas' },
    { name: 'gmail_get_unread', description: 'Fetch unread emails from the last N days' },
    { name: 'gmail_get_thread', description: 'Fetch a full email thread by thread ID' },
    { name: 'gmail_send_reply', description: 'Send a reply to an email thread' },
    { name: 'gmail_compose', description: 'Compose and send a new email' },
    { name: 'gmail_search', description: 'Search emails using Gmail search syntax' },
  ]
  res.json(tools)
})

// POST /api/bot/chat
botRouter.post('/chat', validate(BotChatSchema), async (req, res) => {
  try {
    const { message } = req.body
    const sessionId = await getOrCreateSession('bot-web')
    await sendPromptAsync(sessionId, message)

    // Poll for reply
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500))
      const msgs = await getSessionMessages(sessionId)
      const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant')
      if (last?.parts) {
        const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
        if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
          return res.json({ response: texts.join('') })
        }
      }
    }
    res.status(504).json({ error: 'Timeout waiting for response' })
  } catch (err) {
    errorResponse(res, err)
  }
})
