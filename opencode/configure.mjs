#!/usr/bin/env node
// Merge zync's pieces into an opencode config file without clobbering user settings:
//   - the zync-jobs MCP server (schedule jobs from chat)
//   - our skills folder (schedule-job skill)
//   - a "job" agent used for unattended scheduled runs
//
// Usage: node opencode/configure.mjs <config-file>
// Env:   ZYNC_MCP_PATH, ZYNC_SKILLS_DIR, WORKSPACES_ROOT, TZ, NTFY_* are forwarded to the MCP server.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const target = process.argv[2]
if (!target) {
  console.error('usage: configure.mjs <config-file>')
  process.exit(1)
}

const mcpPath = process.env.ZYNC_MCP_PATH || path.resolve(here, '../packages/jobs/dist/mcp.js')
const skillsDir = process.env.ZYNC_SKILLS_DIR || path.resolve(here, 'skills')

let config = {}
if (existsSync(target)) {
  try {
    config = JSON.parse(readFileSync(target, 'utf8'))
  } catch (err) {
    console.error(`[configure] ${target} is not plain JSON (${err.message}); leaving it untouched`)
    process.exit(0)
  }
}

const env = { WORKSPACES_ROOT: process.env.WORKSPACES_ROOT || '/workspace' }
if (process.env.TZ) env.TZ = process.env.TZ

config.$schema ??= 'https://opencode.ai/config.json'
config.mcp ??= {}
config.mcp['zync-jobs'] = {
  type: 'local',
  command: ['node', mcpPath],
  environment: env,
  enabled: true,
}

config.skills ??= {}
config.skills.paths = [...new Set([...(config.skills.paths || []), skillsDir])]

config.agent ??= {}
config.agent.job ??= {
  description: 'Runs scheduled jobs unattended (no questions, no approvals).',
  mode: 'primary',
  permission: {
    edit: 'allow',
    bash: 'allow',
    webfetch: 'allow',
    websearch: 'allow',
    question: 'deny',
    external_directory: 'deny',
    doom_loop: 'deny',
  },
}

mkdirSync(path.dirname(target), { recursive: true })
writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`)
console.log(`[configure] wrote ${target} (mcp: ${mcpPath}, skills: ${skillsDir})`)
