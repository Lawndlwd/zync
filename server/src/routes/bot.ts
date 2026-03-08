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
import { getSecret, getSecrets } from '../secrets/index.js'
import { getConfig, getConfigService } from '../config/index.js'
import { searchMemory, saveMemory, deleteMemory, listAllMemories, getMemoryCount } from '../bot/memory/index.js'
import { getAllSchedules } from '../bot/heartbeat/db.js'
import { addSchedule, adminRemoveSchedule, adminToggleSchedule } from '../bot/heartbeat/scheduler.js'
import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { getChannelManager } from '../channels/manager.js'
import { TelegramAdapter } from '../channels/telegram.js'
import { WhatsAppAdapter } from '../channels/whatsapp.js'
import { sendMorningBriefing, sendEveningRecap, scheduleBriefings } from '../proactive/briefing.js'
import { getRecommendations } from '../proactive/recommendations.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import type { ChannelType } from '../channels/types.js'
import { logger } from '../lib/logger.js'

const DATA_DIR = resolve(import.meta.dirname, '../../data')

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
      toolCount: 47,
      activeSchedules,
      totalSchedules: schedules.length,
      modelName: 'opencode',
      providerName: 'OpenCode',
      isLocal: false,
      channels,
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

    const channels: ChannelType[] = ['telegram', 'whatsapp', 'gmail']
    const result = channels.map((channel) => {
      let configured = false
      if (channel === 'telegram') configured = !!(getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN'))
      if (channel === 'whatsapp') configured = !!getConfig('WHATSAPP_ALLOWED_NUMBERS')
      if (channel === 'gmail') configured = !!(getSecret('CHANNEL_GMAIL_CLIENT_ID') && getSecret('CHANNEL_GMAIL_CLIENT_SECRET') && getSecret('CHANNEL_GMAIL_REFRESH_TOKEN'))

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
    const masked: any = {}

    // Telegram
    const botToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN')
    const allowedUsers = getConfig('TELEGRAM_ALLOWED_USERS') || ''
    if (botToken || allowedUsers) {
      masked.telegram = {
        botToken: botToken ? '••••' + botToken.slice(-6) : '',
        allowedUsers,
        hasBotToken: !!botToken,
      }
    }

    // WhatsApp
    const waAllowedNumbers = getConfig('WHATSAPP_ALLOWED_NUMBERS') || ''
    const autoReply = getConfig('WHATSAPP_AUTO_REPLY') === 'true'
    const autoReplyInstructions = getConfig('WHATSAPP_AUTO_REPLY_INSTRUCTIONS') || ''
    if (waAllowedNumbers || autoReply || autoReplyInstructions) {
      masked.whatsapp = {
        allowedNumbers: waAllowedNumbers,
        autoReply,
        autoReplyInstructions,
      }
    }

    // Gmail / Google
    const clientId = getSecret('CHANNEL_GMAIL_CLIENT_ID') || ''
    const clientSecret = getSecret('CHANNEL_GMAIL_CLIENT_SECRET')
    const refreshToken = getSecret('CHANNEL_GMAIL_REFRESH_TOKEN')
    if (clientId || clientSecret || refreshToken) {
      masked.gmail = {
        clientId,
        hasClientSecret: !!clientSecret,
        authorized: !!refreshToken,
        mode: 'on-demand',
        enabledServices: getEnabledGoogleServices(),
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
    const secretsSvc = getSecrets()
    const configSvc = getConfigService()

    let schema: z.ZodType
    if (channel === 'telegram') schema = TelegramConfigSchema
    else if (channel === 'whatsapp') schema = WhatsAppConfigSchema
    else if (channel === 'gmail') schema = GmailConfigSchema
    else return res.status(400).json({ error: 'Unknown channel' })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })

    if (channel === 'telegram') {
      const { botToken, allowedUsers } = parsed.data as z.infer<typeof TelegramConfigSchema>
      if (secretsSvc && botToken && botToken !== '••••••••' && !botToken.startsWith('••••')) {
        secretsSvc.set('CHANNEL_TELEGRAM_BOT_TOKEN', botToken, 'channel')
      }
      if (configSvc && allowedUsers !== undefined) {
        configSvc.set('TELEGRAM_ALLOWED_USERS', allowedUsers ?? '', 'channels')
      }
    } else if (channel === 'whatsapp') {
      const { allowedNumbers, autoReply, autoReplyInstructions } = parsed.data as z.infer<typeof WhatsAppConfigSchema>
      if (configSvc) {
        if (allowedNumbers !== undefined) configSvc.set('WHATSAPP_ALLOWED_NUMBERS', allowedNumbers ?? '', 'channels')
        if (autoReply !== undefined) configSvc.set('WHATSAPP_AUTO_REPLY', String(autoReply), 'channels')
        if (autoReplyInstructions !== undefined) configSvc.set('WHATSAPP_AUTO_REPLY_INSTRUCTIONS', autoReplyInstructions ?? '', 'channels')
      }
      // Hot-update the running adapter's allowed numbers filter
      if (allowedNumbers !== undefined) {
        const adapter = getChannelManager().getAdapter('whatsapp')
        if (adapter && adapter instanceof WhatsAppAdapter) {
          const nums = (allowedNumbers ?? '').split(',').map(s => s.trim()).filter(Boolean)
            .map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`)
          adapter.setAllowedNumbers(nums.length > 0 ? nums : undefined)
        }
      }
    } else if (channel === 'gmail') {
      const { clientId, clientSecret, refreshToken, enabledServices } = parsed.data as z.infer<typeof GmailConfigSchema>
      if (secretsSvc) {
        if (clientId) secretsSvc.set('CHANNEL_GMAIL_CLIENT_ID', clientId, 'channel')
        if (clientSecret && !clientSecret.startsWith('••••')) secretsSvc.set('CHANNEL_GMAIL_CLIENT_SECRET', clientSecret, 'channel')
        if (refreshToken) secretsSvc.set('CHANNEL_GMAIL_REFRESH_TOKEN', refreshToken, 'channel')
      }
      if (enabledServices && configSvc) {
        configSvc.set('GOOGLE_ENABLED_SERVICES', JSON.stringify(enabledServices), 'channels')
      }
    }

    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Scope mapping for Google services
const GOOGLE_SCOPE_MAP: Record<string, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  drive: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ],
  contacts: [
    'https://www.googleapis.com/auth/contacts.readonly',
  ],
  tasks: [
    'https://www.googleapis.com/auth/tasks',
  ],
}

function getEnabledGoogleServices(): string[] {
  const raw = getConfig('GOOGLE_ENABLED_SERVICES')
  if (!raw) return ['gmail'] // default
  try { return JSON.parse(raw) } catch { return ['gmail'] }
}

function buildGoogleScopes(services: string[]): string {
  const scopes = new Set<string>()
  for (const svc of services) {
    const s = GOOGLE_SCOPE_MAP[svc]
    if (s) s.forEach(scope => scopes.add(scope))
  }
  // Always include at least gmail scopes as fallback
  if (scopes.size === 0) {
    GOOGLE_SCOPE_MAP.gmail.forEach(scope => scopes.add(scope))
  }
  return [...scopes].join(' ')
}

// GET /api/bot/channels/gmail/auth-url — get Google OAuth consent URL
botRouter.get('/channels/gmail/auth-url', (req, res) => {
  try {
    const clientId = getSecret('CHANNEL_GMAIL_CLIENT_ID')
    if (!clientId) {
      return res.status(400).json({ error: 'Save Client ID and Client Secret first.' })
    }

    // Accept ?services=gmail,calendar,drive,contacts,tasks or use stored config
    const servicesParam = req.query.services as string | undefined
    const services = servicesParam
      ? servicesParam.split(',').map(s => s.trim()).filter(Boolean)
      : getEnabledGoogleServices()

    const redirectUri = `${OAUTH_BASE_URL}/api/bot/channels/gmail/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: buildGoogleScopes(services),
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

    const clientId = getSecret('CHANNEL_GMAIL_CLIENT_ID')
    const clientSecret = getSecret('CHANNEL_GMAIL_CLIENT_SECRET')
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

    // Save refresh token to vault
    const secretsSvc = getSecrets()
    if (secretsSvc) secretsSvc.set('CHANNEL_GMAIL_REFRESH_TOKEN', tokens.refresh_token, 'channel')

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

    // Disconnect existing if running
    await manager.unregister(channel)

    if (channel === 'telegram') {
      const botToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN')
      if (!botToken) return res.status(400).json({ error: 'No bot token configured. Save a token first.' })
      const allowedUsers = (getConfig('TELEGRAM_ALLOWED_USERS') || getSecret('TELEGRAM_ALLOWED_USERS') || '')
        .split(',').map(s => s.trim()).filter(Boolean).map(Number)
      const adapter = new TelegramAdapter({ botToken, allowedUsers })
      manager.register(adapter)

      await adapter.start()
    } else if (channel === 'whatsapp') {
      const authDir = getConfig('WHATSAPP_AUTH_DIR', './data/whatsapp-auth') || './data/whatsapp-auth'
      const allowedNumbers = (getConfig('WHATSAPP_ALLOWED_NUMBERS') || '')
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

    const gmailClientId = getSecret('CHANNEL_GMAIL_CLIENT_ID') || ''
    const gmailClientSecret = getSecret('CHANNEL_GMAIL_CLIENT_SECRET') || ''
    const gmailRefreshToken = getSecret('CHANNEL_GMAIL_REFRESH_TOKEN')
    if (!gmailRefreshToken) {
      return res.status(400).json({ error: 'Gmail not configured' })
    }

    const { google } = await import('googleapis')
    const auth = new google.auth.OAuth2(gmailClientId, gmailClientSecret)
    auth.setCredentials({ refresh_token: gmailRefreshToken })
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

// GET /api/bot/channels/gmail/verify — verify connectivity to each enabled Google service
botRouter.get('/channels/gmail/verify', async (_req, res) => {
  try {
    const services = getEnabledGoogleServices()
    const results: Record<string, { ok: boolean; error?: string }> = {}

    for (const svc of services) {
      try {
        if (svc === 'gmail') {
          const { google } = await import('googleapis')
          const { getGmailClient } = await import('../mcp-server/tools/google-auth.js')
          const gmail = getGmailClient()
          await gmail.users.getProfile({ userId: 'me' })
          results.gmail = { ok: true }
        } else if (svc === 'calendar') {
          const { getCalendarClient } = await import('../mcp-server/tools/google-auth.js')
          const cal = getCalendarClient()
          await cal.calendarList.list({ maxResults: 1 })
          results.calendar = { ok: true }
        } else if (svc === 'drive') {
          const { getDriveClient } = await import('../mcp-server/tools/google-auth.js')
          const drive = getDriveClient()
          await drive.about.get({ fields: 'user' })
          results.drive = { ok: true }
        } else if (svc === 'contacts') {
          const { getPeopleClient } = await import('../mcp-server/tools/google-auth.js')
          const people = getPeopleClient()
          await people.people.get({ resourceName: 'people/me', personFields: 'names' })
          results.contacts = { ok: true }
        } else if (svc === 'tasks') {
          const { getTasksClient } = await import('../mcp-server/tools/google-auth.js')
          const tasks = getTasksClient()
          await tasks.tasklists.list({ maxResults: 1 })
          results.tasks = { ok: true }
        }
      } catch (err) {
        results[svc] = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    res.json({ services: results })
  } catch (err) {
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


// GET /api/bot/briefing/config
botRouter.get('/briefing/config', (_req, res) => {
  try {
    const defaultMorningItems = [
      { id: 'jira', label: 'Jira issues', enabled: true },
      { id: 'todos', label: 'To-do items', enabled: true },
      { id: 'calendar', label: 'Calendar events', enabled: true },
      { id: 'emails', label: 'Email digest', enabled: true },
      { id: 'gtasks', label: 'Google Tasks', enabled: true },
      { id: 'motivation', label: 'Motivational message', enabled: true },
    ]
    const defaultEveningItems = [
      { id: 'completed', label: 'Completed tasks', enabled: true },
      { id: 'messages', label: 'Messages handled', enabled: true },
      { id: 'pending', label: 'Pending items', enabled: true },
      { id: 'blockers', label: 'Blockers', enabled: true },
      { id: 'emails', label: 'Email update', enabled: true },
      { id: 'gtasks', label: 'Google Tasks', enabled: true },
    ]

    const rawMorningItems = getConfig('BRIEFING_MORNING_ITEMS')
    const rawEveningItems = getConfig('BRIEFING_EVENING_ITEMS')

    res.json({
      morningCron: getConfig('BRIEFING_MORNING_CRON') || getConfig('MORNING_CRON', '0 8 * * 1-5') || '0 8 * * 1-5',
      eveningCron: getConfig('BRIEFING_EVENING_CRON') || getConfig('EVENING_CRON', '0 18 * * 1-5') || '0 18 * * 1-5',
      channel: getConfig('BRIEFING_CHANNEL') || getConfig('DEFAULT_CHANNEL', 'telegram') || 'telegram',
      chatId: getConfig('BRIEFING_CHAT_ID') || getConfig('DEFAULT_CHAT_ID') || '',
      enabled: getConfig('BRIEFING_ENABLED') === 'true' || !!(getConfig('MORNING_CRON') || getConfig('EVENING_CRON')),
      morningItems: rawMorningItems ? JSON.parse(rawMorningItems) : defaultMorningItems,
      eveningItems: rawEveningItems ? JSON.parse(rawEveningItems) : defaultEveningItems,
      morningInstructions: getConfig('BRIEFING_MORNING_INSTRUCTIONS') || '',
      eveningInstructions: getConfig('BRIEFING_EVENING_INSTRUCTIONS') || '',
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/bot/briefing/config
const BriefingCheckItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  enabled: z.boolean(),
})

const BriefingConfigSchema = z.object({
  morningCron: z.string(),
  eveningCron: z.string(),
  channel: z.string(),
  chatId: z.string(),
  enabled: z.boolean(),
  morningItems: z.array(BriefingCheckItemSchema).optional(),
  eveningItems: z.array(BriefingCheckItemSchema).optional(),
  morningInstructions: z.string().optional(),
  eveningInstructions: z.string().optional(),
})

botRouter.put('/briefing/config', (req, res) => {
  try {
    const result = BriefingConfigSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.flatten() })
    }
    const configSvc = getConfigService()
    if (configSvc) {
      const d = result.data
      configSvc.set('BRIEFING_MORNING_CRON', d.morningCron, 'briefing')
      configSvc.set('BRIEFING_EVENING_CRON', d.eveningCron, 'briefing')
      configSvc.set('BRIEFING_CHANNEL', d.channel, 'briefing')
      configSvc.set('BRIEFING_CHAT_ID', d.chatId, 'briefing')
      configSvc.set('BRIEFING_ENABLED', String(d.enabled), 'briefing')
      if (d.morningItems) configSvc.set('BRIEFING_MORNING_ITEMS', JSON.stringify(d.morningItems), 'briefing')
      if (d.eveningItems) configSvc.set('BRIEFING_EVENING_ITEMS', JSON.stringify(d.eveningItems), 'briefing')
      if (d.morningInstructions !== undefined) configSvc.set('BRIEFING_MORNING_INSTRUCTIONS', d.morningInstructions, 'briefing')
      if (d.eveningInstructions !== undefined) configSvc.set('BRIEFING_EVENING_INSTRUCTIONS', d.eveningInstructions, 'briefing')
    } else {
      // Fallback to JSON file if config service unavailable
      const cfgPath = resolve(DATA_DIR, 'briefing-config.json')
      writeFileSync(cfgPath, JSON.stringify(result.data, null, 2))
    }
    // Reschedule cron jobs with new config
    scheduleBriefings()
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

// GET /api/bot/tools — dynamic from tool group registry
botRouter.get('/tools', async (_req, res) => {
  const { getToolGroups, DEFAULT_ENABLED_GROUPS } = await import('../mcp-server/groups.js')
  const raw = getConfig('MCP_ENABLED_GROUPS')
  const enabledGroups: string[] = raw ? JSON.parse(raw) : DEFAULT_ENABLED_GROUPS
  const allGroups = getToolGroups()

  const tools = allGroups
    .filter(g => g.alwaysOn || enabledGroups.includes(g.id))
    .flatMap(g => g.tools.map(t => ({ name: t.name, description: t.description })))

  res.json(tools)
})

// POST /api/bot/chat
botRouter.post('/chat', validate(BotChatSchema), async (req, res) => {
  try {
    const { message } = req.body
    const sessionId = await getOrCreateSession('chat')
    const response = await waitForResponse(sessionId, message, { timeoutMs: 30_000 })
    res.json({ response: response || 'No response generated.' })
  } catch (err) {
    errorResponse(res, err)
  }
})
