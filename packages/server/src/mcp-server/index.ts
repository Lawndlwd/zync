#!/usr/bin/env node
import pino from 'pino'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { config } from 'dotenv'
import { resolve } from 'path'

const mcpLogger = pino({ level: 'info' }, pino.destination(2))

// Load .env from project root (server/.env)
config({ path: resolve(import.meta.dirname, '../../.env') })

// Initialize databases before tools that use them
import { initBrainDb } from '../memory/brain-db.js'
import { initTodosTable } from './tools/todos.js'
initBrainDb()
initTodosTable()

import { getToolGroups, DEFAULT_ENABLED_GROUPS } from './groups.js'
import { getConfig } from '../config/index.js'

const server = new McpServer({
  name: 'zync',
  version: '1.0.0',
})

// Read enabled groups from config
const raw = getConfig('MCP_ENABLED_GROUPS')
const enabledGroups: string[] = raw ? JSON.parse(raw) : DEFAULT_ENABLED_GROUPS

const allGroups = getToolGroups()
let registeredCount = 0

for (const group of allGroups) {
  if (!group.alwaysOn && !enabledGroups.includes(group.id)) continue
  for (const tool of group.tools) {
    server.tool(tool.name, tool.description, tool.schema, async (args) => ({
      content: [{ type: 'text' as const, text: await tool.handler(args) }],
    }))
    registeredCount++
  }
}

mcpLogger.info({ registeredCount, enabledGroups }, 'Registered MCP tools')

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  mcpLogger.info('zync MCP server running on stdio')
}

main().catch((err) => {
  mcpLogger.error({ err }, 'MCP server error')
  process.exit(1)
})
