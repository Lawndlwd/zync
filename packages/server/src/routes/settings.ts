import { exec } from 'node:child_process'
import { AgentModelConfigSchema } from '@zync/shared/schemas'
import { Router } from 'express'
import { z } from 'zod'
import { getConfig, getConfigService } from '../config/index.js'
import { errorResponse } from '../lib/errors.js'
import { validate } from '../lib/validate.js'
import { DEFAULT_ENABLED_GROUPS, getToolGroups } from '../mcp-server/groups.js'

export const settingsRouter = Router()

// Expose env config to frontend
settingsRouter.get('/', (_req, res) => {
  res.json({
    messages: {
      customEndpoint: getConfig('MESSAGES_ENDPOINT') || '',
    },
  })
})

// PUT /api/settings — save config
const IntegrationConfigSchema = z.object({
  messages: z
    .object({
      customEndpoint: z.string().optional(),
    })
    .optional(),
})

settingsRouter.put('/', (req, res) => {
  try {
    const result = IntegrationConfigSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.flatten() })
    }
    const configSvc = getConfigService()
    const d = result.data

    if (d.messages) {
      if (d.messages.customEndpoint) configSvc?.set('MESSAGES_ENDPOINT', d.messages.customEndpoint, 'general')
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
    opencode: { model: svc?.get('AGENT_MODEL_OPENCODE') || '' },
    bot: { model: svc?.get('AGENT_MODEL_BOT') || '' },
  })
})

// PUT /api/settings/agent-models — save per-feature model overrides
settingsRouter.put('/agent-models', validate(AgentModelConfigSchema), (req, res) => {
  try {
    const svc = getConfigService()
    if (!svc) return res.status(503).json({ error: 'Config service unavailable' })
    const data = req.body as { opencode?: { model: string }; bot?: { model: string } }
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
    groups: allGroups.map((g) => ({
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
