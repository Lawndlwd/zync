#!/usr/bin/env node
// Merge zync's pieces into an opencode config file without clobbering user settings:
//   - the zync-jobs MCP server (schedule jobs from chat)
//   - our skills (schedule-job, kanban, calendar…), copied into <config dir>/skills/ so every skill,
//     agent and command lives in one folder the app can manage (the OpenCode page). A skill is copied
//     once: after that the copy is yours to edit or delete (the page can reset it to zync's version).
//   - a "job" agent used for unattended scheduled runs
//   - the zync plugin (packages/jobs/dist/opencode-plugin.js): the AI's memory, see packages/jobs/src/memory.ts
//
// Usage: node opencode/configure.mjs <config-file>
// Env:   ZYNC_MCP_PATH, ZYNC_PLUGIN_PATH, ZYNC_SKILLS_DIR, WORKSPACES_ROOT, TZ, NTFY_* are forwarded to the MCP server.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const target = process.argv[2]
if (!target) {
  console.error('usage: configure.mjs <config-file>')
  process.exit(1)
}

const mcpPath = process.env.ZYNC_MCP_PATH || path.resolve(here, '../packages/jobs/dist/mcp.js')
const pluginPath = process.env.ZYNC_PLUGIN_PATH || path.join(path.dirname(mcpPath), 'opencode-plugin.js')
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

// One entry for our plugin; an old one (another install path) is replaced, the user's own are kept.
const pluginUrl = `file://${pluginPath}`
const plugins = (config.plugin ?? []).filter(
  (p) => !String(Array.isArray(p) ? p[0] : p).endsWith('/opencode-plugin.js'),
)
config.plugin = [...plugins, pluginUrl]

// Older versions pointed opencode at the app's skills folder; the skills are now copied instead.
if (config.skills?.paths) {
  config.skills.paths = config.skills.paths.filter((p) => p !== skillsDir)
  if (!config.skills.paths.length) delete config.skills.paths
  if (!Object.keys(config.skills).length) delete config.skills
}

const ownSkills = path.join(path.dirname(target), 'skills')
const seededFile = path.join(ownSkills, '.zync-seeded')
let seeded = []
try {
  seeded = JSON.parse(readFileSync(seededFile, 'utf8'))
} catch {}
const copied = []
for (const d of existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }) : []) {
  if (!d.isDirectory() || seeded.includes(d.name)) continue
  const to = path.join(ownSkills, d.name)
  if (!existsSync(to)) {
    cpSync(path.join(skillsDir, d.name), to, { recursive: true })
    copied.push(d.name)
  }
  seeded.push(d.name)
}
mkdirSync(ownSkills, { recursive: true })
writeFileSync(seededFile, `${JSON.stringify(seeded)}\n`)

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
console.log(
  `[configure] wrote ${target} (mcp: ${mcpPath}, plugin: ${pluginPath}${copied.length ? `, added skills: ${copied.join(', ')}` : ''})`,
)
