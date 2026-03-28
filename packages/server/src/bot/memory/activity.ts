import { getBrainDb as getDb } from '../../memory/brain-db.js'
import { getSessionMessages } from '../../opencode/client.js'

export interface LLMCallRecord {
  source: 'chat' | 'bot' | 'schedule' | 'telegram-support' | 'telegram-dm'
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  tool_names: string[]
  duration_ms: number
  session_id?: string
  message_id?: string
  cost?: number
}

/** Extract token usage from the latest assistant message in a session */
export async function extractUsageFromSession(sessionId: string): Promise<{
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
  message_id?: string
}> {
  try {
    const msgs = await getSessionMessages(sessionId)
    const assistantMsgs = msgs.filter((m: any) => m.info?.role === 'assistant')
    const last = assistantMsgs[assistantMsgs.length - 1]
    const info = last?.info
    if (info?.tokens) {
      const output = info.tokens.output || 0
      const reasoning = info.tokens.reasoning || 0
      return {
        model: info.modelID || 'opencode',
        prompt_tokens: 0,
        completion_tokens: output + reasoning,
        total_tokens: output + reasoning,
        cost: info.cost || 0,
        message_id: info.id,
      }
    }
  } catch {
    // fallback to zeros
  }
  return { model: 'opencode', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0 }
}

export function insertLLMCall(record: LLMCallRecord): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO llm_calls (source, model, prompt_tokens, completion_tokens, total_tokens, tool_names, duration_ms, session_id, message_id, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.source,
    record.model,
    record.prompt_tokens,
    record.completion_tokens,
    record.total_tokens,
    JSON.stringify(record.tool_names),
    record.duration_ms,
    record.session_id ?? null,
    record.message_id ?? null,
    record.cost ?? null,
  )
}

export function isSessionSynced(sessionId: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM llm_calls WHERE session_id = ? LIMIT 1').get(sessionId)
  return !!row
}

export function insertOpenCodeSession(record: {
  sessionId: string
  source: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  createdAt: string
}): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO llm_calls (session_id, source, model, prompt_tokens, completion_tokens, total_tokens, cost, tool_names, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 0, ?)
  `).run(
    record.sessionId,
    record.source,
    record.model,
    record.promptTokens,
    record.completionTokens,
    record.totalTokens,
    record.cost,
    record.createdAt,
  )
}

export function getRecentCalls(limit = 50, offset = 0) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM llm_calls ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset)
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        ...r,
        tool_names: JSON.parse((r.tool_names as string) || '[]'),
      }
    })
}

export function getActivityStats(days = 30) {
  const db = getDb()
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const totals = db
    .prepare(`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
      COALESCE(SUM(cost), 0) as total_cost
    FROM llm_calls WHERE created_at >= ?
  `)
    .get(since) as Record<string, number>

  const byModel = db
    .prepare(`
    SELECT
      model,
      COUNT(*) as calls,
      COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens
    FROM llm_calls WHERE created_at >= ?
    GROUP BY model ORDER BY total_tokens DESC
  `)
    .all(since)

  const byDay = db
    .prepare(`
    SELECT
      date(created_at) as day,
      COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as completion_tokens,
      COUNT(*) as calls
    FROM llm_calls WHERE created_at >= ?
    GROUP BY date(created_at) ORDER BY day ASC
  `)
    .all(since)

  const byDaySource = db
    .prepare(`
    SELECT
      date(created_at) as day,
      source,
      COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost), 0) as cost,
      COUNT(*) as calls
    FROM llm_calls WHERE created_at >= ?
    GROUP BY date(created_at), source ORDER BY day ASC
  `)
    .all(since)

  const bySource = db
    .prepare(`
    SELECT
      source,
      COUNT(*) as calls,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost), 0) as cost
    FROM llm_calls WHERE created_at >= ?
    GROUP BY source
  `)
    .all(since)

  const callsToday = (
    db
      .prepare(`
    SELECT COUNT(*) as count FROM llm_calls WHERE date(created_at) = date('now')
  `)
      .get() as Record<string, number>
  ).count

  return { totals, byModel, byDay, byDaySource, bySource, callsToday }
}
