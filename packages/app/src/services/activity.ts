const API_BASE = '/api/activity'

export interface LLMCall {
  id: number
  source: 'chat' | 'bot' | 'schedule' | 'opencode' | 'dashboard' | 'code-review'
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number | null
  session_id: string | null
  tool_names: string[]
  duration_ms: number
  created_at: string
}

export interface ActivityStats {
  totals: {
    total_calls: number
    total_prompt_tokens: number
    total_completion_tokens: number
    total_tokens: number
    avg_duration_ms: number
    total_cost: number
  }
  byModel: Array<{
    model: string
    calls: number
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }>
  byDay: Array<{
    day: string
    prompt_tokens: number
    completion_tokens: number
    calls: number
  }>
  byDaySource: Array<{
    day: string
    source: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cost: number
    calls: number
  }>
  bySource: Array<{
    source: string
    calls: number
    total_tokens: number
    cost: number
  }>
  callsToday: number
}

export async function syncOpenCode(): Promise<{ synced: number }> {
  const res = await fetch(`${API_BASE}/sync-opencode`, { method: 'POST' })
  if (!res.ok) throw new Error(`Sync error: ${res.status}`)
  return res.json()
}

export async function fetchActivity(limit = 50, offset = 0): Promise<LLMCall[]> {
  const res = await fetch(`${API_BASE}?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error(`Activity error: ${res.status}`)
  return res.json()
}

export async function fetchActivityStats(days = 30): Promise<ActivityStats> {
  const res = await fetch(`${API_BASE}/stats?days=${days}`)
  if (!res.ok) throw new Error(`Activity stats error: ${res.status}`)
  return res.json()
}
