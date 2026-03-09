import { Router } from 'express'
import { z } from 'zod'
import { exec } from 'child_process'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { AgentModelConfigSchema } from '@zync/shared/schemas'
import { getSecret, getSecrets } from '../secrets/index.js'
import { getConfig, getConfigService } from '../config/index.js'
import { getToolGroups, DEFAULT_ENABLED_GROUPS } from '../mcp-server/groups.js'

export const settingsRouter = Router()

// Expose env config to frontend (secrets are masked)
settingsRouter.get('/', (_req, res) => {
  res.json({
    jira: {
      baseUrl: getConfig('JIRA_BASE_URL') || '',
      email: getConfig('JIRA_EMAIL') || '',
      apiToken: getSecret('JIRA_API_TOKEN') ? '••••••••' : '',
      projectKey: getConfig('JIRA_PROJECT_KEY') || '',
    },
    gitlab: {
      baseUrl: getConfig('GITLAB_BASE_URL') || '',
      pat: getSecret('GITLAB_PAT') ? '••••••••' : '',
    },
    github: {
      baseUrl: getConfig('GITHUB_BASE_URL') || '',
      pat: getSecret('GITHUB_PAT') ? '••••••••' : '',
    },
    messages: {
      customEndpoint: getConfig('MESSAGES_ENDPOINT') || '',
    },
    linear: {
      apiKey: getSecret('LINEAR_API_KEY') ? '••••••••' : '',
      defaultTeamId: getConfig('LINEAR_DEFAULT_TEAM_ID') || '',
    },
  })
})

// PUT /api/settings — save integration config to vault
const IntegrationConfigSchema = z.object({
  jira: z.object({
    baseUrl: z.string().optional(),
    email: z.string().optional(),
    apiToken: z.string().optional(),
    projectKey: z.string().optional(),
  }).optional(),
  gitlab: z.object({
    baseUrl: z.string().optional(),
    pat: z.string().optional(),
  }).optional(),
  github: z.object({
    baseUrl: z.string().optional(),
    pat: z.string().optional(),
  }).optional(),
  messages: z.object({
    customEndpoint: z.string().optional(),
  }).optional(),
  linear: z.object({
    apiKey: z.string().optional(),
    defaultTeamId: z.string().optional(),
  }).optional(),
})

settingsRouter.put('/', (req, res) => {
  try {
    const result = IntegrationConfigSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.flatten() })
    }
    const secretsSvc = getSecrets()
    if (!secretsSvc) {
      return res.status(503).json({ error: 'Vault not available' })
    }
    const d = result.data
    const isMasked = (v?: string) => !v || v.startsWith('••••')

    const configSvc = getConfigService()

    if (d.jira) {
      if (d.jira.baseUrl) configSvc?.set('JIRA_BASE_URL', d.jira.baseUrl, 'jira')
      if (d.jira.email) configSvc?.set('JIRA_EMAIL', d.jira.email, 'jira')
      if (!isMasked(d.jira.apiToken)) secretsSvc.set('JIRA_API_TOKEN', d.jira.apiToken!, 'jira')
      if (d.jira.projectKey) configSvc?.set('JIRA_PROJECT_KEY', d.jira.projectKey, 'jira')
    }
    if (d.gitlab) {
      if (d.gitlab.baseUrl) configSvc?.set('GITLAB_BASE_URL', d.gitlab.baseUrl, 'gitlab')
      if (!isMasked(d.gitlab.pat)) secretsSvc.set('GITLAB_PAT', d.gitlab.pat!, 'gitlab')
    }
    if (d.github) {
      if (d.github.baseUrl) configSvc?.set('GITHUB_BASE_URL', d.github.baseUrl, 'github')
      if (!isMasked(d.github.pat)) secretsSvc.set('GITHUB_PAT', d.github.pat!, 'github')
    }
    if (d.messages) {
      if (d.messages.customEndpoint) configSvc?.set('MESSAGES_ENDPOINT', d.messages.customEndpoint, 'general')
    }
    if (d.linear) {
      if (!isMasked(d.linear.apiKey)) secretsSvc.set('LINEAR_API_KEY', d.linear.apiKey!, 'linear')
      if (d.linear.defaultTeamId) configSvc?.set('LINEAR_DEFAULT_TEAM_ID', d.linear.defaultTeamId, 'linear')
    }

    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
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

// GET /api/settings/mcp-tools — list tool groups with enabled status
settingsRouter.get('/mcp-tools', (_req, res) => {
  const raw = getConfig('MCP_ENABLED_GROUPS')
  const enabledGroups: string[] = raw ? JSON.parse(raw) : DEFAULT_ENABLED_GROUPS
  const allGroups = getToolGroups()

  res.json({
    groups: allGroups.map(g => ({
      id: g.id,
      label: g.label,
      toolCount: g.tools.length,
      alwaysOn: g.alwaysOn || false,
      enabled: g.alwaysOn || enabledGroups.includes(g.id),
    })),
  })
})

// PUT /api/settings/mcp-tools — save enabled groups and restart MCP server
const McpToolsSchema = z.object({
  enabledGroups: z.array(z.string()),
})

settingsRouter.put('/mcp-tools', (req, res) => {
  try {
    const result = McpToolsSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.flatten() })
    }
    const svc = getConfigService()
    if (!svc) return res.status(503).json({ error: 'Config service unavailable' })

    svc.set('MCP_ENABLED_GROUPS', JSON.stringify(result.data.enabledGroups), 'mcp')

    // Kill the MCP server process so OpenCode respawns it with new config
    exec("pkill -f 'mcp-server/index.ts'", () => {
      // Process might not be running, that's ok
    })

    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
