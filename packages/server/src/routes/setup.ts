import { SetupVerifySchema } from '@zync/shared/schemas'
import { Router } from 'express'
import { getConfig, getConfigService } from '../config/index.js'
import { errorResponse } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { validate } from '../lib/validate.js'
import { getSecret, getSecrets } from '../secrets/index.js'

export const setupRouter = Router()

// GET /api/setup/status — check onboarding state
setupRouter.get('/status', (_req, res) => {
  try {
    const configSvc = getConfigService()
    const completed = configSvc?.get('setup.completedOnboarding') === 'true'
    const vaultAvailable = !!getSecrets()

    // Check which integrations already have credentials saved
    const configuredIntegrations: Record<string, boolean> = {
      telegram: !!(getSecret('TELEGRAM_BOT_TOKEN') || getSecret('CHANNEL_TELEGRAM_BOT_TOKEN')),
      whatsapp: !!getConfig('WHATSAPP_ALLOWED_NUMBERS'),
      gmail: !!getSecret('CHANNEL_GMAIL_CLIENT_ID'),
    }

    // Check app settings
    const configuredSettings: Record<string, boolean> = {
      'default-model': !!(configSvc?.get('AGENT_MODEL_BOT') || configSvc?.get('AGENT_MODEL_OPENCODE')),
      briefings: !!configSvc?.get('DEFAULT_CHAT_ID'),
    }

    res.json({
      initialized: completed,
      vaultStatus: vaultAvailable ? 'available' : 'uninitialized',
      hasPin: vaultAvailable ? getSecrets()!.hasPin() : false,
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
    const message =
      err.name === 'TimeoutError'
        ? 'Connection timed out — check the URL'
        : err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND')
          ? 'Cannot reach server — check the URL'
          : err.message || 'Verification failed'
    logger.warn({ err, service }, 'Setup verification failed')
    res.json({ ok: false, message })
  }
})
