import { Router } from 'express'
import { spawn, execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { loadGitlabConfig } from './gitlab.js'
import { getOpenCodeUrl } from '../opencode/client.js'
import { getDb } from '../bot/memory/db.js'
import { validate } from '../lib/validate.js'
import { PrAgentRunSchema } from '../lib/schemas.js'

export const prAgentRouter = Router()

const AGENT_MODELS_PATH = resolve(import.meta.dirname, '../../data/agent-models.json')
const VENV_PYTHON = resolve(import.meta.dirname, '../../.venv/bin/python')
const WRAPPER_SCRIPT = resolve(import.meta.dirname, '../../scripts/run_pr_agent.py')
const VALID_TOOLS = ['review', 'describe', 'improve', 'ask'] as const
type PRAgentTool = (typeof VALID_TOOLS)[number]

async function buildPRAgentEnv(tool: PRAgentTool, question?: string, extraInstructions?: string): Promise<Record<string, string>> {
  const gitlab = loadGitlabConfig()

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    CONFIG__GIT_PROVIDER: 'gitlab',
    GITLAB__URL: gitlab.baseUrl.replace(/\/api\/v4\/?$/, ''),
    GITLAB__PERSONAL_ACCESS_TOKEN: gitlab.pat,
    OPENCODE_URL: getOpenCodeUrl(),
  }

  // ── PR-Agent tool settings ──

  // /review — thorough analysis
  env['PR_REVIEWER__NUM_MAX_FINDINGS'] = '10'
  env['PR_REVIEWER__REQUIRE_SECURITY_REVIEW'] = 'true'
  env['PR_REVIEWER__REQUIRE_TESTS_REVIEW'] = 'true'
  env['PR_REVIEWER__REQUIRE_SCORE_REVIEW'] = 'true'
  env['PR_REVIEWER__REQUIRE_ESTIMATE_EFFORT_TO_REVIEW'] = 'true'
  env['PR_REVIEWER__REQUIRE_CAN_BE_SPLIT_REVIEW'] = 'false'
  env['PR_REVIEWER__REQUIRE_TODO_SCAN'] = 'true'
  env['PR_REVIEWER__REQUIRE_TICKET_ANALYSIS_REVIEW'] = 'true'
  env['PR_REVIEWER__ENABLE_REVIEW_LABELS_SECURITY'] = 'true'
  env['PR_REVIEWER__ENABLE_REVIEW_LABELS_EFFORT'] = 'true'
  env['PR_REVIEWER__PERSISTENT_COMMENT'] = 'true'

  // /improve — more suggestions
  env['PR_CODE_SUGGESTIONS__NUM_CODE_SUGGESTIONS'] = '6'
  env['PR_CODE_SUGGESTIONS__FOCUS_ONLY_ON_PROBLEMS'] = 'true'
  env['PR_CODE_SUGGESTIONS__SUGGESTIONS_SCORE_THRESHOLD'] = '0'

  // /describe — richer descriptions
  env['PR_DESCRIPTION__ENABLE_PR_TYPE'] = 'true'
  env['PR_DESCRIPTION__ENABLE_PR_DIAGRAM'] = 'true'
  env['PR_DESCRIPTION__USE_BULLET_POINTS'] = 'true'
  env['PR_DESCRIPTION__ADD_ORIGINAL_USER_DESCRIPTION'] = 'true'
  env['PR_DESCRIPTION__USE_DESCRIPTION_MARKERS'] = 'false'
  env['PR_DESCRIPTION__ENABLE_LARGE_PR_HANDLING'] = 'false'

  if (question) {
    env['PR_AGENT_QUESTION'] = question
  }

  if (extraInstructions) {
    const toolEnvMap: Record<PRAgentTool, string> = {
      review: 'PR_REVIEWER__EXTRA_INSTRUCTIONS',
      describe: 'PR_DESCRIPTION__EXTRA_INSTRUCTIONS',
      improve: 'PR_CODE_SUGGESTIONS__EXTRA_INSTRUCTIONS',
      ask: 'PR_REVIEWER__EXTRA_INSTRUCTIONS',
    }
    env[toolEnvMap[tool]] = extraInstructions
  }

  return env
}


/**
 * Rewrite the MR web URL to use numeric project ID instead of path.
 */
function rewriteMrUrl(webUrl: string, projectId: number): string {
  const match = webUrl.match(/^(https?:\/\/[^/]+)\/(.+?)\/-\/merge_requests\/(\d+)/)
  if (!match) return webUrl
  return `${match[1]}/${projectId}/-/merge_requests/${match[3]}`
}

// POST /api/pr-agent/run — Execute a PR-Agent tool
prAgentRouter.post('/run', validate(PrAgentRunSchema), async (req, res) => {
  const { tool, mrUrl, projectId, mrIid, headSha, question, extraInstructions } = req.body as {
    tool: string
    mrUrl: string
    projectId?: number
    mrIid?: number
    headSha?: string
    question?: string
    extraInstructions?: string
  }

  if (!existsSync(VENV_PYTHON)) {
    res.status(503).json({
      error: 'PR-Agent not installed',
      message: 'Run: cd server && python3 -m venv .venv && .venv/bin/pip install pr-agent',
    })
    return
  }

  // SSE setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  send('status', { message: `Running /${tool} on MR...` })

  // Read per-app model config for PR Agent
  let prAgentModel: string | undefined
  try {
    if (existsSync(AGENT_MODELS_PATH)) {
      const agentModels = JSON.parse(readFileSync(AGENT_MODELS_PATH, 'utf-8'))
      if (agentModels.prAgent?.model) {
        prAgentModel = agentModels.prAgent.model
        send('status', { message: `Using model: ${prAgentModel}` })
      }
    }
  } catch (err: any) {
    send('debug', { modelConfigError: err.message })
  }

  const env = await buildPRAgentEnv(tool as PRAgentTool, question, extraInstructions)

  const effectiveUrl = projectId ? rewriteMrUrl(mrUrl, projectId) : mrUrl
  env['PR_URL'] = effectiveUrl
  env['PR_TOOL'] = tool as string
  if (prAgentModel) {
    env['OPENCODE_MODEL'] = prAgentModel
  }

  // Send resolved extra instructions for debugging
  const extraKey = Object.keys(env).find(k => k.endsWith('__EXTRA_INSTRUCTIONS'))
  if (extraKey && env[extraKey]) {
    send('debug', { extraInstructions: env[extraKey], envKey: extraKey })
  }

  // Enable full prompt dump when debugging
  if (extraInstructions) {
    env['PR_AGENT_DEBUG_PROMPTS'] = '1'
  }

  const child = spawn(VENV_PYTHON, [WRAPPER_SCRIPT], {
    env,
    timeout: 300_000,
  })

  const chunks: string[] = []
  let stdoutBuffer = ''

  // Stream stdout — parse tagged lines from the wrapper script
  child.stdout.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString()
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('[CHUNK] ')) {
        const content = line.slice(8)
        if (chunks.length === 0) {
          send('status', { message: `Receiving /${tool} output...` })
        }
        chunks.push(content)
        send('chunk', { content })
      } else if (line.startsWith('[PROMPT] ')) {
        try {
          const promptData = JSON.parse(line.slice(9))
          send('prompt', promptData)
        } catch { /* skip malformed */ }
      } else if (line.startsWith('[FULL_SYSTEM] ')) {
        send('prompt_system', { line: line.slice(14) })
      } else if (line.startsWith('[FULL_USER] ')) {
        send('prompt_user', { line: line.slice(12) })
      } else if (line === '[DONE]') {
        // handled in close
      }
    }
  })

  // Log stderr but don't flood the client with it
  let stderrLog = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrLog += chunk.toString()
  })

  const saveResult = (result: unknown) => {
    if (projectId && mrIid && headSha) {
      try {
        const db = getDb()
        db.prepare(`
          INSERT INTO pr_agent_results (project_id, mr_iid, tool, head_sha, result, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).run(projectId, mrIid, tool, headSha, JSON.stringify(result))
      } catch { /* best-effort cache */ }
    }
  }

  child.on('close', (code) => {
    // Flush remaining buffer
    if (stdoutBuffer.trim()) {
      if (stdoutBuffer.startsWith('[CHUNK] ')) {
        chunks.push(stdoutBuffer.slice(8))
      }
    }

    if (code !== 0 && chunks.length === 0) {
      const lastLines = stderrLog.trim().split('\n').slice(-10).join('\n')
      send('error', { message: `PR-Agent exited with code ${code}${lastLines ? `: ${lastLines}` : ''}` })
      res.end()
      return
    }

    const fullOutput = chunks.join('\n\n').trim()
    if (!fullOutput) {
      send('error', { message: `/${tool} produced no output` })
      res.end()
      return
    }

    // Try to extract inline structured JSON from the LLM response
    const jsonTagMatch = fullOutput.match(/<structured_json>([\s\S]*?)<\/structured_json>/)
    const rawOutput = fullOutput.replace(/<structured_json>[\s\S]*?<\/structured_json>/g, '').trim()

    if (jsonTagMatch) {
      try {
        const parsed = JSON.parse(jsonTagMatch[1].trim())
        const full = { ...parsed, rawOutput }
        send('result', full)
        saveResult(full)
        res.end()
        return
      } catch { /* fall through to fallback */ }
    }

    // Fallback: no inline JSON found — use raw output directly
    const fallback = {
      tool,
      summary: `/${tool} completed`,
      items: [{ severity: 'info' as const, title: `${tool} output`, body: rawOutput }],
      rawOutput,
    }
    send('result', fallback)
    saveResult(fallback)
    res.end()
  })

  // Handle client disconnect
  res.on('close', () => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
    }
  })
})

// GET /api/pr-agent/results/:projectId/:mrIid — Get all results (chat history)
prAgentRouter.get('/results/:projectId/:mrIid', (req, res) => {
  const projectId = Number(req.params.projectId)
  const mrIid = Number(req.params.mrIid)

  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT id, tool, head_sha, result, created_at
      FROM pr_agent_results
      WHERE project_id = ? AND mr_iid = ?
      ORDER BY created_at ASC
    `).all(projectId, mrIid) as { id: number; tool: string; head_sha: string; result: string; created_at: string }[]

    res.json(rows.map(r => ({
      id: r.id,
      tool: r.tool,
      headSha: r.head_sha,
      result: JSON.parse(r.result),
      createdAt: r.created_at,
    })))
  } catch {
    res.json([])
  }
})

// GET /api/pr-agent/status — Health check
prAgentRouter.get('/status', (_req, res) => {
  if (!existsSync(VENV_PYTHON)) {
    res.json({
      available: false,
      message: 'Python venv not found. Run: cd server && python3 -m venv .venv && .venv/bin/pip install pr-agent',
    })
    return
  }

  execFile(VENV_PYTHON, ['-c', 'from importlib.metadata import version; print(version("pr-agent"))'], {
    timeout: 10_000,
  }, (error, stdout) => {
    if (error) {
      res.json({
        available: false,
        message: 'pr-agent package not installed. Run: server/.venv/bin/pip install pr-agent',
      })
      return
    }
    res.json({
      available: true,
      version: stdout.trim(),
    })
  })
})
