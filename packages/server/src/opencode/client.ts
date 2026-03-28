import { EventSource } from 'eventsource'
import { getConfig } from '../config/index.js'

const OPENCODE_URL = getConfig('OPENCODE_URL', 'http://localhost:4096') || 'http://localhost:4096'

// Raw HTTP client for OpenCode — the SDK has issues with session.prompt returning empty data
// and model config inheritance bugs. Direct HTTP is more reliable.

async function oc(path: string, options?: RequestInit) {
  const res = await fetch(`${OPENCODE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenCode ${res.status}: ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}

// Session cache: purpose → sessionId
const sessionMap = new Map<string, string>()

// Active dashboard session — set by frontend, used by channels
let _activeDashboardSessionId: string | null = null

export function setActiveDashboardSession(id: string | null) {
  _activeDashboardSessionId = id
}

export function getActiveDashboardSession(): string | null {
  return _activeDashboardSessionId
}

export async function getOrCreateSession(purpose: string, agent?: string): Promise<string> {
  // 1. Check in-memory cache
  const cached = sessionMap.get(purpose)
  if (cached) {
    try {
      await oc(`/session/${cached}`)
      return cached
    } catch {
      sessionMap.delete(purpose)
    }
  }

  // 2. Search existing OpenCode sessions for a matching title (survives server restarts)
  const title = `[dashboard] ${purpose}`
  try {
    const sessions = await listSessions()
    const match = sessions.find((s: any) => s.title === title)
    if (match?.id) {
      sessionMap.set(purpose, match.id)
      return match.id
    }
  } catch {
    // ignore — fall through to create
  }

  // 3. Create new session
  const session = await oc('/session', {
    method: 'POST',
    body: JSON.stringify({
      title,
      ...(agent ? { agent } : {}),
    }),
  })
  if (!session?.id) throw new Error('Failed to create OpenCode session')
  sessionMap.set(purpose, session.id)
  return session.id
}

export async function sendPromptAsync(
  sessionId: string,
  text: string,
  model?: { providerID: string; modelID: string },
): Promise<void> {
  await oc(`/session/${sessionId}/prompt_async`, {
    method: 'POST',
    body: JSON.stringify({
      parts: [{ type: 'text', text }],
      ...(model ? { model } : {}),
    }),
  })
}

export async function getSessionMessages(sessionId: string): Promise<any[]> {
  const msgs = await oc(`/session/${sessionId}/message`)
  return Array.isArray(msgs) ? msgs : []
}

export async function isSessionIdle(sessionId: string): Promise<boolean> {
  try {
    const statuses = await oc('/session/status')
    const status = statuses?.[sessionId]
    // If the session is not in the status map, it's idle (completed sessions are removed)
    // If it IS in the map, it's idle only when type === 'idle'
    if (!status) return true
    return status.type === 'idle'
  } catch {
    return false
  }
}

export function getOpenCodeUrl(): string {
  return OPENCODE_URL
}

/** Start a persistent SSE listener on OpenCode to track session completions server-side */
export function startUsageTracker(onSessionComplete: (sessionId: string) => void): void {
  const connect = () => {
    const es = new EventSource(`${OPENCODE_URL}/global/event`)

    es.onmessage = (e: any) => {
      try {
        const raw = JSON.parse(e.data)
        const payload = raw.payload || raw
        const type = payload.type

        if (type === 'session.status') {
          const status = payload.properties?.status?.type || payload.properties?.status
          if (status === 'idle' || status === 'completed') {
            onSessionComplete(payload.properties.sessionID)
          }
        } else if (type === 'session.idle') {
          onSessionComplete(payload.properties?.sessionID)
        } else if (type === 'session.updated') {
          const info = payload.properties?.info
          if (info && (info.status === 'idle' || info.status === 'completed')) {
            onSessionComplete(info.id)
          }
        }
      } catch {
        // ignore
      }
    }

    es.onerror = () => {
      es.close()
      setTimeout(connect, 5000)
    }
  }

  setTimeout(connect, 3000)
}

export async function checkConnection(): Promise<boolean> {
  try {
    await oc('/config')
    return true
  } catch {
    return false
  }
}

async function listSessions(): Promise<any[]> {
  const data = await oc('/session')
  return Array.isArray(data) ? data : []
}

// Token stats cache — keyed by days param
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const statsCache = new Map<string, { data: TokenStatsResult; ts: number }>()

interface TokenStatsResult {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
  total: number
  models: string[]
  sessionCount: number
}

export async function getTokenStats(days?: number): Promise<TokenStatsResult> {
  const cacheKey = String(days ?? 'all')
  const cached = statsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data
  }

  let sessions = await listSessions()

  if (days) {
    const cutoff = Date.now() - days * 86_400_000
    sessions = sessions.filter((s: any) => {
      const ts = s.time?.updated || s.time?.created || 0
      return (ts < 1e12 ? ts * 1000 : ts) >= cutoff
    })
  }

  let input = 0,
    output = 0,
    reasoning = 0,
    cacheRead = 0,
    cacheWrite = 0,
    cost = 0
  const models = new Set<string>()

  const results = await Promise.allSettled(sessions.map((s: any) => getSessionMessages(s.id)))

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    // Per session: input tokens represent the full context window and are NOT additive
    // across messages — only the last message's input counts for this session.
    // Output, reasoning, cache, and cost ARE additive (each turn generates new tokens).
    let sessionInput = 0
    for (const item of result.value) {
      const info = item.info || item
      if (info.tokens) {
        if (info.tokens.input > 0) sessionInput = info.tokens.input
        output += info.tokens.output || 0
        reasoning += info.tokens.reasoning || 0
        cacheRead += info.tokens.cache?.read || 0
        cacheWrite += info.tokens.cache?.write || 0
      }
      if (info.cost) cost += info.cost
      if (info.modelID) models.add(info.modelID)
    }
    input += sessionInput
  }

  const data: TokenStatsResult = {
    input,
    output,
    reasoning,
    cacheRead,
    cacheWrite,
    cost,
    total: input + output + reasoning,
    models: Array.from(models),
    sessionCount: sessions.length,
  }

  statsCache.set(cacheKey, { data, ts: Date.now() })
  return data
}

export async function getProviderConfig(): Promise<
  Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>
> {
  const data = await oc('/config/providers')
  if (!data?.providers) return []
  return data.providers.map((p: any) => ({
    id: p.id,
    name: p.name,
    models: Object.values(p.models || {}).map((m: any) => ({
      id: m.id,
      name: m.name,
    })),
  }))
}
