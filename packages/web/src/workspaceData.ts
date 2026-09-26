import { useQueries, useQuery } from '@tanstack/react-query'
import { api, type Board, type Card, type JobRow, type Person, type RunRecord, type TreeEntry } from './api'

// Everything the shell and the Overview derive their numbers from. Query keys match the other
// views so caches (and live invalidation from the workspace event stream) are shared.

export interface BoardCard {
  board: Board
  card: Card
  /** Workspace-relative card file — what a card's job points at. */
  ref: string
}

export interface RunEvent {
  job: string
  title: string
  kind: 'job' | 'card'
  run: RunRecord
  time: Date
}

export interface WorkspaceData {
  jobs: JobRow[]
  boards: Board[]
  cards: BoardCard[]
  runs: RunEvent[]
  recent: TreeEntry[]
  fileCount: number
  people: Person[]
}

export function useWorkspaceData(ws: string): WorkspaceData {
  const jobs = useQuery({ queryKey: ['jobs', ws], queryFn: () => api.jobs(ws), refetchInterval: 15_000 }).data ?? []
  const boards = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) }).data ?? []
  const people = useQuery({ queryKey: ['people'], queryFn: api.people }).data ?? []
  const recentQ = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) }).data
  const boardQs = useQueries({
    queries: boards.map((b) => ({
      queryKey: ['board', ws, b.path],
      queryFn: () => api.board(ws, b.path),
      refetchInterval: 15_000,
    })),
  })
  const runQs = useQueries({
    queries: jobs.map((j) => ({ queryKey: ['runs', ws, j.name], queryFn: () => api.runs(ws, j.name) })),
  })

  const cards: BoardCard[] = []
  for (const q of boardQs) {
    if (!q.data) continue
    for (const card of q.data.cards) cards.push({ board: q.data.board, card, ref: `${q.data.board.path}/${card.file}` })
  }

  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const runs: RunEvent[] = []
  jobs.forEach((j, i) => {
    const ref = j.job?.card
    const title = ref ? (byRef.get(ref)?.card.title ?? basenameNoExt(ref)) : j.name
    for (const run of runQs[i]?.data ?? []) {
      runs.push({ job: j.name, title, kind: ref ? 'card' : 'job', run, time: new Date(run.ts) })
    }
  })
  runs.sort((a, b) => b.time.getTime() - a.time.getTime())

  return {
    jobs,
    boards,
    cards,
    runs,
    recent: recentQ?.entries ?? [],
    fileCount: recentQ?.total ?? 0,
    people,
  }
}

const basenameNoExt = (p: string) => p.slice(p.lastIndexOf('/') + 1).replace(/\.md$/, '')

// ── derived ────────────────────────────────────────────────────────────────

function isDoneColumn(board: Board, status?: string): boolean {
  const last = board.columns[board.columns.length - 1]?.id
  return (status ?? board.columns[0]?.id) === last
}

/** Cards the AI finished and moved to Review, newest first. */
export function reviewCards(cards: BoardCard[]): BoardCard[] {
  return cards
    .filter((c) => c.card.status === 'review' && c.card.ai?.state === 'done')
    .sort((a, b) => (b.card.ai?.finishedAt ?? '').localeCompare(a.card.ai?.finishedAt ?? ''))
}

export function runningCards(cards: BoardCard[]): BoardCard[] {
  return cards.filter((c) => c.card.ai?.state === 'running')
}

/** Open cards assigned to me: overdue and soonest first, undated last. */
export function myCards(cards: BoardCard[]): BoardCard[] {
  return cards
    .filter((c) => c.card.assignee === 'me' && !isDoneColumn(c.board, c.card.status))
    .sort((a, b) => (a.card.due ?? '￿').localeCompare(b.card.due ?? '￿'))
}

export function dueDate(due: string): Date {
  return new Date(due.length === 10 ? `${due}T23:59` : due)
}

export function dueThisWeek(cards: BoardCard[], now = new Date()): BoardCard[] {
  const end = addDays(startOfWeek(now), 7)
  return cards.filter((c) => c.card.due && !isDoneColumn(c.board, c.card.status) && dueDate(c.card.due) < end)
}

/** Upcoming scheduled runs across all jobs, soonest first. */
export function upcoming(jobs: JobRow[], cards: BoardCard[], now = new Date()) {
  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const out: { time: Date; job: string; title: string; kind: 'job' | 'card' }[] = []
  for (const j of jobs) {
    if (!j.job?.enabled) continue
    const ref = j.job.card
    const title = ref ? (byRef.get(ref)?.card.title ?? basenameNoExt(ref)) : j.name
    for (const iso of j.nextRuns) {
      const time = new Date(iso)
      if (time > now) out.push({ time, job: j.name, title, kind: ref ? 'card' : 'job' })
    }
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

// ── dates ──────────────────────────────────────────────────────────────────

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Monday 00:00 of d's week. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()

export const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Thu 24 Sep" (fixed English labels, like the design, whatever the browser locale). */
export const dayLabel = (d: Date) => `${WD[d.getDay()]} ${pad2(d.getDate())} ${MO[d.getMonth()]}`

/** "Sat 26 Sep 2026 · 11:42" */
export const stamp = (d: Date) => `${dayLabel(d)} ${d.getFullYear()} · ${hhmm(d)}`

export const weekday = (d: Date) => WD[d.getDay()]

/** "in 2h 48m" */
export function until(d: Date, now = new Date()): string {
  const mins = Math.max(0, Math.round((d.getTime() - now.getTime()) / 60_000))
  if (mins < 60) return `in ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `in ${h}h ${mins % 60}m`
  return `in ${Math.round(h / 24)}d`
}

/** "Now", "12 min ago", "1 h ago", "Yesterday", "Thu 24 Sep" */
export function ago(d: Date, now = new Date()): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000)
  if (mins < 1) return 'Now'
  if (mins < 60) return `${mins} min ago`
  if (sameDay(d, now)) return `${Math.floor(mins / 60)} h ago`
  if (sameDay(d, addDays(now, -1))) return 'Yesterday'
  return dayLabel(d)
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
