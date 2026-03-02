import { Router } from 'express'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { loadGitlabConfig } from './gitlab.js'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { AgentModelConfigSchema } from '../lib/schemas.js'
import { getSecret } from '../secrets/index.js'

export const settingsRouter = Router()

// --- Agent model config (simple JSON file) ---

const AGENT_MODELS_PATH = resolve(import.meta.dirname, '../../data/agent-models.json')

interface AgentModelConfig {
  prAgent?: { model: string }
  opencode?: { model: string }
  bot?: { model: string }
}

function loadAgentModels(): AgentModelConfig {
  try {
    if (existsSync(AGENT_MODELS_PATH)) {
      return JSON.parse(readFileSync(AGENT_MODELS_PATH, 'utf-8'))
    }
  } catch { /* use defaults */ }
  return {}
}

function saveAgentModels(config: AgentModelConfig): void {
  mkdirSync(dirname(AGENT_MODELS_PATH), { recursive: true })
  writeFileSync(AGENT_MODELS_PATH, JSON.stringify(config, null, 2))
}

// Expose env config to frontend (secrets are masked)
settingsRouter.get('/', (_req, res) => {
  res.json({
    jira: {
      baseUrl: getSecret('JIRA_BASE_URL') || '',
      email: getSecret('JIRA_EMAIL') || '',
      apiToken: getSecret('JIRA_API_TOKEN') ? '••••••••' : '',
      projectKey: getSecret('JIRA_PROJECT_KEY') || '',
    },
    gitlab: (() => {
      const saved = loadGitlabConfig()
      return {
        baseUrl: getSecret('GITLAB_BASE_URL') || saved.baseUrl || '',
        pat: (getSecret('GITLAB_PAT') || saved.pat) ? '••••••••' : '',
      }
    })(),
    messages: {
      customEndpoint: getSecret('MESSAGES_ENDPOINT') || '',
    },
  })
})

// GET /api/settings/agent-models — get per-feature model overrides
settingsRouter.get('/agent-models', (_req, res) => {
  res.json(loadAgentModels())
})

// PUT /api/settings/agent-models — save per-feature model overrides
settingsRouter.put('/agent-models', validate(AgentModelConfigSchema), (req, res) => {
  try {
    const config = req.body as AgentModelConfig
    saveAgentModels(config)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
