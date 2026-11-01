#!/usr/bin/env node
// Merge zync's pieces into an opencode config file without clobbering user settings:
//   - the zync-jobs MCP server (schedule jobs from chat)
//   - our skills (schedule-job, kanban, calendar…), copied into <config dir>/skills/ so every skill,
//     agent and command lives in one folder the app can manage (the OpenCode page). A skill is copied
//     once: after that the copy is yours to edit or delete (the page can reset it to zync's version).
//   - a "job" agent used for unattended scheduled runs
//   - the zync plugin (the folder packages/jobs/dist/opencode-plugin, loaded through its server.js): the
//     AI's memory, see packages/jobs/src/opencode-plugin/server.ts
//   - opencode v1 → v2 fixes for custom providers, which v2 reads differently (see v2Compat)
//
// Usage: node opencode/configure.mjs <config-file>
// Env:   ZYNC_MCP_PATH, ZYNC_PLUGIN_PATH, ZYNC_SKILLS_DIR, WORKSPACES_ROOT, TZ, NTFY_*, ZYNC_INTERNAL_TOKEN and
//        ZYNC_API_INTERNAL_URL are forwarded to the MCP server.

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
// v2 loads local plugins from a folder, never a single file.
const pluginPath = process.env.ZYNC_PLUGIN_PATH || path.join(path.dirname(mcpPath), 'opencode-plugin')
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
// Connected accounts are read through the api's internal port (see packages/jobs/src/connections).
// The token stays an {env:…} reference, so it is never written into this file.
if (process.env.ZYNC_INTERNAL_TOKEN) {
  env.ZYNC_INTERNAL_TOKEN = '{env:ZYNC_INTERNAL_TOKEN}'
  // Docker sets http://api:3002; without it the MCP client uses the local api (127.0.0.1:3002).
  if (process.env.ZYNC_API_INTERNAL_URL) env.ZYNC_API_INTERNAL_URL = process.env.ZYNC_API_INTERNAL_URL
}

config.$schema ??= 'https://opencode.ai/config.json'
config.mcp ??= {}
config.mcp['zync-jobs'] = {
  type: 'local',
  command: ['node', mcpPath],
  environment: env,
  enabled: true,
}

// One entry for our plugin, in v2's `plugins`; an old one (v1's `plugin` file entry, another install
// path) is replaced, the user's own are kept.
const pluginUrl = `file://${pluginPath}`
const entryPath = (p) => String(Array.isArray(p) ? p[0] : typeof p === 'object' && p ? p.package : p)
const isOurs = (p) => /\/opencode-plugin(\.js|\/?)$/.test(entryPath(p))
if (config.plugin) {
  config.plugin = config.plugin.filter((p) => !isOurs(p))
  if (!config.plugin.length) delete config.plugin
}
config.plugins = [...(config.plugins ?? []).filter((p) => !isOurs(p)), pluginUrl]

// opencode v2 reads two v1 provider settings differently; keep what they did under v1:
//   - a custom provider without `npm` was OpenAI-compatible; v2 refuses it ("Unsupported package"),
//   - a model's `options.max_tokens` capped the answer; v2 ignores it and sends its own, larger cap.
for (const [id, provider] of Object.entries(config.provider ?? {})) {
  if (!provider || typeof provider !== 'object') continue
  if (!provider.npm && provider.options?.baseURL && provider.models) {
    provider.npm = '@ai-sdk/openai-compatible'
    console.log(`[configure] provider ${id}: npm = @ai-sdk/openai-compatible (opencode v2 needs it)`)
  }
  for (const [modelId, model] of Object.entries(provider.models ?? {})) {
    const max = model?.options?.max_tokens
    if (typeof max === 'number' && model.limit?.output === undefined) {
      model.limit = { ...model.limit, output: max }
      console.log(`[configure] model ${id}/${modelId}: limit.output = ${max} (from options.max_tokens)`)
    }
  }
}

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
