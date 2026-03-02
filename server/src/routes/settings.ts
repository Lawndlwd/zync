import { Router } from 'express'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { AgentModelConfigSchema } from '../lib/schemas.js'
import { getSecret } from '../secrets/index.js'
import { getConfig, getConfigService } from '../config/index.js'

export const settingsRouter = Router()

// Expose env config to frontend (secrets are masked)
settingsRouter.get('/', (_req, res) => {
  res.json({
    jira: {
      baseUrl: getSecret('JIRA_BASE_URL') || '',
      email: getSecret('JIRA_EMAIL') || '',
      apiToken: getSecret('JIRA_API_TOKEN') ? '••••••••' : '',
      projectKey: getSecret('JIRA_PROJECT_KEY') || '',
    },
    gitlab: {
      baseUrl: getSecret('GITLAB_BASE_URL') || getConfig('GITLAB_BASE_URL') || '',
      pat: getSecret('GITLAB_PAT') ? '••••••••' : '',
    },
    messages: {
      customEndpoint: getSecret('MESSAGES_ENDPOINT') || '',
    },
  })
})

// GET /api/settings/agent-models — get per-feature model overrides
settingsRouter.get('/agent-models', (_req, res) => {
  const svc = getConfigService()
  res.json({
    prAgent: { model: svc?.get('AGENT_MODEL_PR') || '' },
    opencode: { model: svc?.get('AGENT_MODEL_OPENCODE') || '' },
    bot: { model: svc?.get('AGENT_MODEL_BOT') || '' },
  })
})

// PUT /api/settings/agent-models — save per-feature model overrides
settingsRouter.put('/agent-models', validate(AgentModelConfigSchema), (req, res) => {
  try {
    const svc = getConfigService()
    if (!svc) return res.status(503).json({ error: 'Config service unavailable' })
    const data = req.body as { prAgent?: { model: string }; opencode?: { model: string }; bot?: { model: string } }
    if (data.prAgent?.model) svc.set('AGENT_MODEL_PR', data.prAgent.model, 'llm')
    if (data.opencode?.model) svc.set('AGENT_MODEL_OPENCODE', data.opencode.model, 'llm')
    if (data.bot?.model) svc.set('AGENT_MODEL_BOT', data.bot.model, 'llm')
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
