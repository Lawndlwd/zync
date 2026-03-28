import type {
  AutopilotBreaker,
  DailyLever,
  IdentityStatement,
  LifeOsComponent,
  LifeOsJournalEntry,
  LifeOsStats,
  XpEvent,
} from '@zync/shared/types'

const API = '/api/planner/life-os'

function rowToComponent(row: any): LifeOsComponent {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    isActive: !!row.is_active,
    targetDate: row.target_date,
    progress: row.progress || 0,
    linkedGoalId: row.linked_goal_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToIdentity(row: any): IdentityStatement {
  return {
    id: row.id,
    statement: row.statement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToLever(row: any): DailyLever {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    date: row.date,
    completed: !!row.completed,
    completedAt: row.completed_at,
    order: row.order,
    createdAt: row.created_at,
  }
}

function rowToBreaker(row: any): AutopilotBreaker {
  return {
    id: row.id,
    time: row.time,
    question: row.question,
    enabled: !!row.enabled,
    createdAt: row.created_at,
  }
}

function rowToJournal(row: any): LifeOsJournalEntry {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    responses: typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses || [],
    pageId: row.page_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

function rowToXpEvent(row: any): XpEvent {
  return {
    id: row.id,
    type: row.type,
    xp: row.xp,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
  }
}

// --- Components ---
export async function fetchLifeOsComponents(): Promise<LifeOsComponent[]> {
  const res = await fetch(`${API}/components`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(rowToComponent) : []
}

export async function fetchLifeOsComponent(type: string): Promise<LifeOsComponent | null> {
  const res = await fetch(`${API}/components/${type}`)
  const data = await res.json()
  return data ? rowToComponent(data) : null
}

export async function createLifeOsComponent(body: {
  type: string
  title: string
  content?: string
  targetDate?: string
  isActive?: boolean
}): Promise<LifeOsComponent> {
  const res = await fetch(`${API}/components`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return rowToComponent(await res.json())
}

export async function updateLifeOsComponent(id: string, body: Record<string, unknown>): Promise<LifeOsComponent> {
  const res = await fetch(`${API}/components/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return rowToComponent(await res.json())
}

export async function deleteLifeOsComponent(id: string): Promise<void> {
  await fetch(`${API}/components/${id}`, { method: 'DELETE' })
}

// --- Identity ---
export async function fetchIdentity(): Promise<IdentityStatement | null> {
  const res = await fetch(`${API}/identity`)
  const data = await res.json()
  return data ? rowToIdentity(data) : null
}

export async function upsertIdentity(statement: string): Promise<IdentityStatement> {
  const res = await fetch(`${API}/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statement }),
  })
  return rowToIdentity(await res.json())
}

// --- Daily Levers ---
export async function fetchDailyLevers(date?: string): Promise<DailyLever[]> {
  const params = date ? `?date=${date}` : ''
  const res = await fetch(`${API}/levers${params}`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(rowToLever) : []
}

export async function createDailyLever(body: { title: string; date: string; projectId?: string }): Promise<DailyLever> {
  const res = await fetch(`${API}/levers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return rowToLever(await res.json())
}

export async function toggleDailyLever(id: string): Promise<DailyLever> {
  const res = await fetch(`${API}/levers/${id}/toggle`, { method: 'PUT' })
  return rowToLever(await res.json())
}

export async function deleteDailyLever(id: string): Promise<void> {
  await fetch(`${API}/levers/${id}`, { method: 'DELETE' })
}

// --- Autopilot Breakers ---
export async function fetchAutopilotBreakers(): Promise<AutopilotBreaker[]> {
  const res = await fetch(`${API}/breakers`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(rowToBreaker) : []
}

export async function createAutopilotBreaker(body: { time: string; question: string }): Promise<AutopilotBreaker> {
  const res = await fetch(`${API}/breakers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return rowToBreaker(await res.json())
}

export async function updateAutopilotBreaker(id: string, body: Record<string, unknown>): Promise<AutopilotBreaker> {
  const res = await fetch(`${API}/breakers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return rowToBreaker(await res.json())
}

export async function deleteAutopilotBreaker(id: string): Promise<void> {
  await fetch(`${API}/breakers/${id}`, { method: 'DELETE' })
}

// --- Journal ---
export async function fetchJournalEntry(date: string, type: string): Promise<LifeOsJournalEntry | null> {
  const res = await fetch(`${API}/journal?date=${date}&type=${type}`)
  const data = await res.json()
  return data ? rowToJournal(data) : null
}

export async function fetchJournalEntries(opts?: {
  from?: string
  to?: string
  type?: string
}): Promise<LifeOsJournalEntry[]> {
  const params = new URLSearchParams()
  if (opts?.from) params.set('from', opts.from)
  if (opts?.to) params.set('to', opts.to)
  if (opts?.type) params.set('type', opts.type)
  const res = await fetch(`${API}/journal?${params}`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(rowToJournal) : []
}

export async function saveJournalEntry(body: {
  date: string
  type: string
  responses: unknown[]
  pageId?: string
  completedAt?: string
}): Promise<LifeOsJournalEntry> {
  const res = await fetch(`${API}/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return rowToJournal(await res.json())
}

// --- XP ---
export async function fetchXpEvents(opts?: { from?: string; to?: string }): Promise<XpEvent[]> {
  const params = new URLSearchParams()
  if (opts?.from) params.set('from', opts.from)
  if (opts?.to) params.set('to', opts.to)
  const res = await fetch(`${API}/xp?${params}`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(rowToXpEvent) : []
}

// --- Stats ---
export async function fetchLifeOsStats(): Promise<LifeOsStats> {
  const res = await fetch(`${API}/stats`)
  return await res.json()
}

// --- Psy Tracker ---
export async function fetchPsyScores(days = 30): Promise<{ date: string; score: number; note: string | null }[]> {
  const res = await fetch(`${API}/psy-tracker?days=${days}`)
  return await res.json()
}

export async function fetchPsyScoreToday(): Promise<{ date: string; score: number; note: string | null } | null> {
  const res = await fetch(`${API}/psy-tracker/today`)
  return await res.json()
}

export async function upsertPsyScore(date: string, score: number, note?: string): Promise<unknown> {
  const res = await fetch(`${API}/psy-tracker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, score, note }),
  })
  return await res.json()
}

// --- Journal Streak ---
export async function fetchJournalStreak(): Promise<{ streak: number; last30: boolean[] }> {
  const res = await fetch(`${API}/journal-streak`)
  return await res.json()
}
