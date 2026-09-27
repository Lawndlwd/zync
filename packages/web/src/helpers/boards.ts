import type { Board, Card, CardPatch } from '../types/boards'
import type { JobRow } from '../types/jobs'
import type { BoardCard } from '../types/workspace'
import { addDays, dueDate, startOfWeek } from './dates'
import { stripMd } from './paths'

/** A column name as a column id. */
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, 30) || 'col'
  )
}

/** Strip nulls so an optimistic update matches what the server will return. */
export function applyLocal(card: Card, patch: CardPatch): Card {
  const next: Card = { ...card }
  for (const [k, v] of Object.entries<unknown>(patch)) {
    if (v === null) delete (next as Record<string, unknown>)[k]
    else if (v !== undefined) Object.assign(next, { [k]: v })
  }
  return next
}

/** The column new cards go to (a board always has at least one column). */
export const firstColumn = (board: Pick<Board, 'columns'>): string => board.columns[0]?.id ?? 'backlog'

/** The column a card is shown in: its status, or the first column when unknown. */
export const statusOf = (board: Board, c: Card) =>
  c.status && board.columns.some((col) => col.id === c.status) ? c.status : firstColumn(board)

export const doneColumn = (board: Board) => board.columns.at(-1)?.id

/** Is `status` (unset = the first column) the board's last, "done" column? */
const isDoneColumn = (board: Board, status?: string) => (status ?? board.columns[0]?.id) === doneColumn(board)

/** Cards the AI finished and moved to Review, newest first. */
export function reviewCards(cards: BoardCard[]): BoardCard[] {
  return cards
    .filter((c) => c.card.status === 'review' && c.card.ai?.state === 'done')
    .toSorted((a, b) => (b.card.ai?.finishedAt ?? '').localeCompare(a.card.ai?.finishedAt ?? ''))
}

export function runningCards(cards: BoardCard[]): BoardCard[] {
  return cards.filter((c) => c.card.ai?.state === 'running')
}

/** Open cards assigned to me: overdue and soonest first, undated last. */
export function myCards(cards: BoardCard[]): BoardCard[] {
  return cards
    .filter((c) => c.card.assignee === 'me' && !isDoneColumn(c.board, c.card.status))
    .toSorted((a, b) => (a.card.due ?? '￿').localeCompare(b.card.due ?? '￿'))
}

export function dueThisWeek(cards: BoardCard[], now = new Date()): BoardCard[] {
  const end = addDays(startOfWeek(now), 7)
  return cards.filter((c) => c.card.due && !isDoneColumn(c.board, c.card.status) && dueDate(c.card.due) < end)
}

/** Upcoming scheduled runs across all jobs, soonest first. */
export function upcoming(jobs: JobRow[], cards: BoardCard[], now = new Date()) {
  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const out: Array<{ time: Date; job: string; title: string; kind: 'job' | 'card' }> = []
  for (const j of jobs) {
    if (!j.job?.enabled) continue
    const ref = j.job.card
    const title = ref ? (byRef.get(ref)?.card.title ?? stripMd(ref)) : j.name
    for (const iso of j.nextRuns) {
      const time = new Date(iso)
      if (time > now) out.push({ time, job: j.name, title, kind: ref ? 'card' : 'job' })
    }
  }
  return out.toSorted((a, b) => a.time.getTime() - b.time.getTime())
}
