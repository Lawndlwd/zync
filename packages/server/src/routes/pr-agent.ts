import { Router } from 'express'
import { spawn, execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { getSecret } from '../secrets/index.js'
import { getConfig } from '../config/index.js'
import { getOpenCodeUrl, getActiveDashboardSession, getOrCreateSession } from '../opencode/client.js'
import { insertLLMCall } from '../bot/memory/activity.js'
import { validate } from '../lib/validate.js'
import { PrAgentRunSchema } from '@zync/shared/schemas'

export const prAgentRouter = Router()

const AGENT_MODELS_PATH = resolve(import.meta.dirname, '../../data/agent-models.json')
const VENV_PYTHON = resolve(import.meta.dirname, '../../../pr-agent/.venv/bin/python')
const WRAPPER_SCRIPT = resolve(import.meta.dirname, '../../../pr-agent/run_pr_agent.py')
const VALID_TOOLS = ['review', 'describe', 'improve', 'ask'] as const
type PRAgentTool = (typeof VALID_TOOLS)[number]

/**
 * Parse raw PR-Agent review markdown into structured items.
 * Looks for "Key issues to review" section and extracts issue blocks.
 */
function parseRawReviewMarkdown(raw: string): { severity: string; title: string; file?: string; line?: number; body: string }[] {
  const items: { severity: string; title: string; file?: string; line?: number; body: string }[] = []

  // Pattern: **Title** or **Category: Title** followed by description text
  // PR-Agent "Key issues" format: bold title on its own line, description below
  const issuePattern = /\*\*(?:(\w[\w\s]*?)\s*[:：]\s*)?(.+?)\*\*\s*\n([\s\S]*?)(?=\n\*\*[\w]|\n#{1,3}\s|$)/g
  let match

  // Find the "Key issues" section or similar
  const keyIssuesStart = raw.search(/key issues to review|issues found|code feedback/i)
  const searchText = keyIssuesStart >= 0 ? raw.slice(keyIssuesStart) : raw

  while ((match = issuePattern.exec(searchText)) !== null) {
    const category = (match[1] || '').trim().toLowerCase()
    const title = match[2].trim()
    const body = match[3].trim()

    // Skip non-issue bold text (headers, labels, etc.)
    if (!body || body.length < 10) continue
    if (/^(score|estimated|pr contains|no security|security)/i.test(title)) continue

    // Map category to severity
    let severity = 'suggestion'
    if (/bug|error|critical|major/i.test(category)) severity = 'critical'
    else if (/warning|medium|performance/i.test(category)) severity = 'warning'
    else if (/smell|minor|low|style/i.test(category)) severity = 'suggestion'

    // Try to extract file reference from the body
    let file: string | undefined
    let line: number | undefined
    const fileMatch = body.match(/[`']?(\S+\.\w{1,5}(?::\d+)?)[`']?/)
    if (fileMatch) {
      const parts = fileMatch[1].split(':')
      file = parts[0]
      if (parts[1]) line = Number(parts[1]) || undefined
    }

    items.push({ severity, title, file, line, body })
  }

  return items
}

async function buildPRAgentEnv(tool: PRAgentTool, question?: string, extraInstructions?: string, provider?: 'gitlab' | 'github'): Promise<Record<string, string>> {
  const gitlabBaseUrl = getConfig('GITLAB_BASE_URL') || ''
  const gitlabPat = getSecret('GITLAB_PAT') || ''

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    'CONFIG.GIT_PROVIDER': provider || 'gitlab',
    'GITLAB.URL': gitlabBaseUrl.replace(/\/api\/v4\/?$/, ''),
    'GITLAB.PERSONAL_ACCESS_TOKEN': gitlabPat,
    OPENCODE_URL: getOpenCodeUrl(),
  }

  // ── PR-Agent tool settings (dynaconf uses dot separators) ──

  // /review — thorough analysis
  env['PR_REVIEWER.NUM_MAX_FINDINGS'] = '10'
  env['PR_REVIEWER.REQUIRE_SECURITY_REVIEW'] = 'true'
  env['PR_REVIEWER.REQUIRE_TESTS_REVIEW'] = 'true'
  env['PR_REVIEWER.REQUIRE_SCORE_REVIEW'] = 'true'
  env['PR_REVIEWER.REQUIRE_ESTIMATE_EFFORT_TO_REVIEW'] = 'true'
  env['PR_REVIEWER.REQUIRE_CAN_BE_SPLIT_REVIEW'] = 'false'
  env['PR_REVIEWER.REQUIRE_TODO_SCAN'] = 'true'
  env['PR_REVIEWER.REQUIRE_TICKET_ANALYSIS_REVIEW'] = 'true'
  env['PR_REVIEWER.ENABLE_REVIEW_LABELS_SECURITY'] = 'true'
  env['PR_REVIEWER.ENABLE_REVIEW_LABELS_EFFORT'] = 'true'
  env['PR_REVIEWER.PERSISTENT_COMMENT'] = 'true'

  // /improve — more suggestions
  env['PR_CODE_SUGGESTIONS.NUM_CODE_SUGGESTIONS'] = '6'
  env['PR_CODE_SUGGESTIONS.FOCUS_ONLY_ON_PROBLEMS'] = 'true'
  env['PR_CODE_SUGGESTIONS.SUGGESTIONS_SCORE_THRESHOLD'] = '0'

  // /describe — richer descriptions
  env['PR_DESCRIPTION.ENABLE_PR_TYPE'] = 'true'
  env['PR_DESCRIPTION.ENABLE_PR_DIAGRAM'] = 'true'
  env['PR_DESCRIPTION.USE_BULLET_POINTS'] = 'true'
  env['PR_DESCRIPTION.ADD_ORIGINAL_USER_DESCRIPTION'] = 'true'
  env['PR_DESCRIPTION.USE_DESCRIPTION_MARKERS'] = 'false'
  env['PR_DESCRIPTION.ENABLE_LARGE_PR_HANDLING'] = 'false'

  // GitHub provider support
  if (provider === 'github') {
    const githubPat = getSecret('GITHUB_PAT') || ''
    env['CONFIG.GIT_PROVIDER'] = 'github'
    env['GITHUB.USER_TOKEN'] = githubPat
    delete env['GITLAB.URL']
    delete env['GITLAB.PERSONAL_ACCESS_TOKEN']
  }

  if (question) {
    env['PR_AGENT_QUESTION'] = question
  }

  if (extraInstructions) {
    const toolEnvMap: Record<PRAgentTool, string> = {
      review: 'PR_REVIEWER.EXTRA_INSTRUCTIONS',
      describe: 'PR_DESCRIPTION.EXTRA_INSTRUCTIONS',
      improve: 'PR_CODE_SUGGESTIONS.EXTRA_INSTRUCTIONS',
      ask: 'PR_REVIEWER.EXTRA_INSTRUCTIONS',
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
  const { tool, mrUrl, projectId, mrIid, headSha, question, extraInstructions, sessionId: reqSessionId } = req.body as {
    tool: string
    mrUrl: string
    projectId?: number
    mrIid?: number
    headSha?: string
    question?: string
    extraInstructions?: string
    sessionId?: string
  }

  if (!existsSync(VENV_PYTHON)) {
    res.status(503).json({
      error: 'PR-Agent not installed',
      message: 'Run: cd server && python3 -m venv .venv && .venv/bin/pip install pr-agent',
    })
    return
  }

  // Validate credentials before starting
  const provider = mrUrl.includes('github.com') ? 'github' as const : 'gitlab' as const
  if (provider === 'github' && !getSecret('GITHUB_PAT')) {
    res.status(400).json({ error: 'GitHub PAT not configured. Add it in Settings > Integrations > GitHub.' })
    return
  }
  if (provider === 'gitlab' && !getSecret('GITLAB_PAT')) {
    res.status(400).json({ error: 'GitLab PAT not configured. Add it in Settings > Integrations > GitLab.' })
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    send('debug', { modelConfigError: message })
  }

  const env = await buildPRAgentEnv(tool as PRAgentTool, question, extraInstructions, provider)

  const effectiveUrl = projectId ? rewriteMrUrl(mrUrl, projectId) : mrUrl
  env['PR_URL'] = effectiveUrl
  env['PR_TOOL'] = tool as string
  if (prAgentModel) {
    env['OPENCODE_MODEL'] = prAgentModel
  }
  // Use the session ID from the request (frontend knows which session the user is in)
  const activeSession = reqSessionId || getActiveDashboardSession() || await getOrCreateSession('chat')
  env['OPENCODE_SESSION_ID'] = activeSession

  // Send resolved extra instructions for debugging
  const extraKey = Object.keys(env).find(k => k.endsWith('__EXTRA_INSTRUCTIONS'))
  if (extraKey && env[extraKey]) {
    send('debug', { extraInstructions: env[extraKey], envKey: extraKey })
  }

  // Enable full prompt dump when debugging
  if (extraInstructions) {
    env['PR_AGENT_DEBUG_PROMPTS'] = '1'
  }

  const prAgentStartTime = Date.now()

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

  child.on('close', (code) => {
    const durationMs = Date.now() - prAgentStartTime

    // Flush remaining buffer
    if (stdoutBuffer.trim()) {
      if (stdoutBuffer.startsWith('[CHUNK] ')) {
        chunks.push(stdoutBuffer.slice(8))
      }
    }

    // Log usage regardless of success/failure
    const fullText = chunks.join('\n\n')
    const estimatedPromptTokens = Math.ceil((effectiveUrl.length + (extraInstructions?.length || 0)) / 4)
    const estimatedCompletionTokens = Math.ceil(fullText.length / 4)
    insertLLMCall({
      source: 'code-review',
      model: prAgentModel || 'opencode',
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
      total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
      tool_names: [tool],
      duration_ms: durationMs,
    })

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
        res.end()
        return
      } catch { /* fall through to fallback */ }
    }

    // Fallback: no inline JSON found — parse raw PR-Agent markdown into structured items
    const scoreMatch = rawOutput.match(/Score:\s*(\d+)/)
    const parsedItems = parseRawReviewMarkdown(rawOutput)
    const fallbackSummary = parsedItems.length > 0
      ? `PR review completed with ${parsedItems.length} finding${parsedItems.length !== 1 ? 's' : ''}`
      : `/${tool} completed`
    const fallback = {
      tool,
      summary: fallbackSummary,
      score: scoreMatch ? Number(scoreMatch[1]) : undefined,
      items: parsedItems,
      rawOutput,
    }
    send('result', fallback)
    res.end()
  })

  // Handle client disconnect
  res.on('close', () => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
    }
  })
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
