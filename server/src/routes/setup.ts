import { Router } from 'express'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { SetupVerifySchema } from '../lib/schemas.js'
import { getConfigService, getConfig } from '../config/index.js'
import { getSecrets, getSecret } from '../secrets/index.js'
import { logger } from '../lib/logger.js'

export const setupRouter = Router()

// GET /api/setup/status — check onboarding state
setupRouter.get('/status', (_req, res) => {
  try {
    const configSvc = getConfigService()
    const completed = configSvc?.get('setup.completedOnboarding') === 'true'
    const vaultAvailable = !!getSecrets()

    // Check which integrations already have credentials saved
    const gitlabUrl = getSecret('GITLAB_BASE_URL') || getConfig('GITLAB_BASE_URL')
    const configuredIntegrations: Record<string, boolean> = {
      jira: !!(getSecret('JIRA_BASE_URL') && getSecret('JIRA_API_TOKEN')),
      gitlab: !!(gitlabUrl && getSecret('GITLAB_PAT')),
      telegram: !!(getSecret('TELEGRAM_BOT_TOKEN') || getSecret('CHANNEL_TELEGRAM_BOT_TOKEN')),
      whatsapp: !!getConfig('WHATSAPP_ALLOWED_NUMBERS'),
      gmail: !!(getSecret('GMAIL_CLIENT_ID') || getSecret('CHANNEL_GMAIL_CLIENT_ID') || getSecret('GOOGLE_CLIENT_ID')),
    }

    // Check app settings
    const configuredSettings: Record<string, boolean> = {
      'default-model': !!(configSvc?.get('AGENT_MODEL_BOT') || configSvc?.get('AGENT_MODEL_OPENCODE')),
      briefings: !!(configSvc?.get('DEFAULT_CHAT_ID')),
    }

    res.json({
      initialized: completed,
      vaultStatus: vaultAvailable ? 'available' : 'uninitialized',
      requiredSteps: ['welcome', 'vault', 'integrations', 'configure', 'done'],
      configuredIntegrations,
      configuredSettings,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/setup/complete — mark onboarding done (idempotent)
setupRouter.post('/complete', (_req, res) => {
  try {
    const configSvc = getConfigService()
    if (!configSvc) {
      return res.status(503).json({ error: 'Config service unavailable' })
    }
    configSvc.set('setup.completedOnboarding', 'true', 'setup')
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/setup/verify — test integration credentials
setupRouter.post('/verify', validate(SetupVerifySchema), async (req, res) => {
  const { service, config } = req.body

  try {
    switch (service) {
      case 'jira': {
        const { baseUrl, email, apiToken } = config
        if (!baseUrl || !apiToken) {
          return res.json({ ok: false, message: 'Missing base URL and API token' })
        }
        const cleanUrl = (baseUrl as string).replace(/\/$/, '')
        const isCloud = cleanUrl.includes('atlassian.net')
        const apiVersion = isCloud ? '3' : '2'
        const authHeader = isCloud
          ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
          : `Bearer ${apiToken}`
        const url = `${cleanUrl}/rest/api/${apiVersion}/myself`
        const resp = await fetch(url, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        })
        if (!resp.ok) {
          const text = await resp.text()
          return res.json({ ok: false, message: `Authentication failed (${resp.status}): ${text.slice(0, 200)}` })
        }
        const user = await resp.json()
        return res.json({ ok: true, message: `Connected as ${user.displayName || user.emailAddress}`, username: user.displayName })
      }

      case 'gitlab': {
        const { baseUrl, pat } = config
        if (!baseUrl || !pat) {
          return res.json({ ok: false, message: 'Missing required fields' })
        }
        const url = `${baseUrl.replace(/\/$/, '')}/api/v4/user`
        const resp = await fetch(url, {
          headers: { 'PRIVATE-TOKEN': pat, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        })
        if (!resp.ok) {
          return res.json({ ok: false, message: `Authentication failed (${resp.status})` })
        }
        const user = await resp.json()
        return res.json({ ok: true, message: `Connected as ${user.username}`, username: user.username })
      }

      case 'telegram': {
        const { botToken } = config
        if (!botToken) {
          return res.json({ ok: false, message: 'Missing bot token' })
        }
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
          signal: AbortSignal.timeout(10000),
        })
        const data = await resp.json()
        if (!data.ok) {
          return res.json({ ok: false, message: data.description || 'Invalid token' })
        }
        return res.json({ ok: true, message: `Connected as @${data.result.username}`, username: data.result.username })
      }

      case 'llm': {
        const { provider, apiKey } = config
        if (!apiKey) {
          return res.json({ ok: false, message: 'Missing API key' })
        }

        let url: string
        let headers: Record<string, string>

        if (provider === 'anthropic') {
          url = 'https://api.anthropic.com/v1/models'
          headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        } else {
          // Default to OpenAI-compatible
          url = 'https://api.openai.com/v1/models'
          headers = { Authorization: `Bearer ${apiKey}` }
        }

        const resp = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(10000),
        })
        if (!resp.ok) {
          return res.json({ ok: false, message: `API key verification failed (${resp.status})` })
        }
        return res.json({ ok: true, message: `API key valid (${provider || 'openai'})` })
      }

      default:
        return res.json({ ok: false, message: `Unknown service: ${service}` })
    }
  } catch (err: any) {
    const message = err.name === 'TimeoutError'
      ? 'Connection timed out — check the URL'
      : err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND')
        ? 'Cannot reach server — check the URL'
        : err.message || 'Verification failed'
    logger.warn({ err, service }, 'Setup verification failed')
    res.json({ ok: false, message })
  }
})
