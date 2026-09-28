#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerBoardTools } from './mcp/tools/boards.js'
import { registerBriefTools } from './mcp/tools/briefs.js'
import { registerCalendarTools } from './mcp/tools/calendar.js'
import { registerConnectionTools } from './mcp/tools/connections.js'
import { registerJobTools } from './mcp/tools/jobs.js'
import { registerPeopleTools } from './mcp/tools/people.js'

// zync's MCP server (stdio): jobs, people, boards, calendar and brief tools for the product's AI, and
// read-only access to the accounts connected in Settings → Connections.

const server = new McpServer({ name: 'zync-jobs', version: '0.1.0' })

registerJobTools(server)
registerPeopleTools(server)
registerBoardTools(server)
registerCalendarTools(server)
registerBriefTools(server)
registerConnectionTools(server)

await server.connect(new StdioServerTransport())
