import { getDb } from './db.js'

export interface LLMCallRecord {
  source: 'chat' | 'bot' | 'schedule' | 'pr-agent'
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  tool_names: string[]
  duration_ms: number
}

export function insertLLMCall(record: LLMCallRecord): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO llm_calls (source, model, prompt_tokens, completion_tokens, total_tokens, tool_names, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.source,
    record.model,
    record.prompt_tokens,
    record.completion_tokens,
    record.total_tokens,
    JSON.stringify(record.tool_names),
    record.duration_ms,
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

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
      COALESCE(SUM(cost), 0) as total_cost
    FROM llm_calls WHERE created_at >= ?
  `).get(since) as Record<string, number>

  const byModel = db.prepare(`
    SELECT
      model,
      COUNT(*) as calls,
      COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens
    FROM llm_calls WHERE created_at >= ?
    GROUP BY model ORDER BY total_tokens DESC
  `).all(since)

  const byDay = db.prepare(`
    SELECT
      date(created_at) as day,
      COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as completion_tokens,
      COUNT(*) as calls
    FROM llm_calls WHERE created_at >= ?
    GROUP BY date(created_at) ORDER BY day ASC
  `).all(since)

  const byDaySource = db.prepare(`
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
  `).all(since)

  const bySource = db.prepare(`
    SELECT
      source,
      COUNT(*) as calls,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost), 0) as cost
    FROM llm_calls WHERE created_at >= ?
    GROUP BY source
  `).all(since)

  const callsToday = (db.prepare(`
    SELECT COUNT(*) as count FROM llm_calls WHERE date(created_at) = date('now')
  `).get() as Record<string, number>).count

  return { totals, byModel, byDay, byDaySource, bySource, callsToday }
}
