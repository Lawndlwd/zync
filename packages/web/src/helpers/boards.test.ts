import { describe, expect, it } from 'vitest'

import type { Board, Card } from '../types/boards'
import type { JobRow } from '../types/jobs'
import type { BoardCard } from '../types/workspace'
import {
  applyLocal,
  doneColumn,
  dueThisWeek,
  firstColumn,
  myCards,
  reviewCards,
  slug,
  statusOf,
  upcoming,
} from './boards'

const board: Board = {
  path: 'b',
  name: 'b',
  columns: [
    { id: 'todo', name: 'To do' },
    { id: 'review', name: 'Review' },
    { id: 'done', name: 'Done' },
  ],
}
const bc = (over: Partial<Card>, file = `${over.title ?? 'x'}.md`): BoardCard => ({
  board,
  ref: `b/${file}`,
  card: { file, title: 'x', labels: [], context: [], description: '', extra: {}, ...over },
})

// Thursday 24 Sep 2026, 15:00 local.
const now = new Date(2026, 8, 24, 15, 0)

describe('card lists', () => {
  it('reviewCards: AI-finished cards in Review, newest first', () => {
    const out = reviewCards([
      bc({ title: 'old', status: 'review', ai: { state: 'done', finishedAt: '2026-09-01T10:00' } }),
      bc({ title: 'new', status: 'review', ai: { state: 'done', finishedAt: '2026-09-20T10:00' } }),
      bc({ title: 'human', status: 'review' }),
      bc({ title: 'failed', status: 'review', ai: { state: 'failed' } }),
    ])
    expect(out.map((c) => c.card.title)).toEqual(['new', 'old'])
  })

  it('myCards: mine and open, soonest due first, undated last', () => {
    const out = myCards([
      bc({ title: 'later', assignee: 'me', due: '2026-10-01' }),
      bc({ title: 'undated', assignee: 'me' }),
      bc({ title: 'soon', assignee: 'me', due: '2026-09-25' }),
      bc({ title: 'done', assignee: 'me', status: 'done' }),
      bc({ title: 'theirs', assignee: 'ai' }),
    ])
    expect(out.map((c) => c.card.title)).toEqual(['soon', 'later', 'undated'])
  })

  it('dueThisWeek: open cards due before next Monday, overdue included', () => {
    const out = dueThisWeek(
      [
        bc({ title: 'overdue', due: '2026-09-01' }),
        bc({ title: 'sunday', due: '2026-09-27' }),
        bc({ title: 'monday', due: '2026-09-28' }),
        bc({ title: 'closed', due: '2026-09-25', status: 'done' }),
      ],
      now,
    )
    expect(out.map((c) => c.card.title)).toEqual(['overdue', 'sunday'])
  })
})

const job = (name: string, nextRuns: string[], extra: Partial<NonNullable<JobRow['job']>> = {}): JobRow => ({
  name,
  nextRuns,
  lastRun: null,
  job: { name, context: [], notify: 'never', enabled: true, instructions: '', ...extra },
})

describe('upcoming', () => {
  it('lists future runs of enabled jobs, soonest first, titled by their card', () => {
    const out = upcoming(
      [
        job('nightly', ['2026-09-25T02:00:00Z', '2026-09-20T02:00:00Z']),
        job('card-job', ['2026-09-24T18:00:00Z'], { card: 'b/task.md' }),
        job('off', ['2026-09-25T02:00:00Z'], { enabled: false }),
      ],
      [bc({ title: 'Task' }, 'task.md')],
      now,
    )
    expect(out.map((u) => [u.title, u.kind])).toEqual([
      ['Task', 'card'],
      ['nightly', 'job'],
    ])
  })
})

const sprint: Board = {
  path: 'Sprint',
  name: 'Sprint',
  columns: [
    { id: 'todo', name: 'To do' },
    { id: 'done', name: 'Done' },
  ],
}
const card: Card = { file: 'a.md', title: 'A', labels: [], context: [], description: '', extra: {}, assignee: 'me' }

describe('slug', () => {
  it('makes a short kebab-case id', () => {
    expect(slug('  In Progress!! ')).toBe('in-progress')
    expect(slug('A'.repeat(40))).toHaveLength(30)
  })

  it('falls back when nothing is left', () => {
    expect(slug('🚀')).toBe('col')
  })
})

describe('applyLocal', () => {
  it('sets values, deletes nulls, ignores undefined', () => {
    const next = applyLocal(card, { title: 'B', assignee: null, due: undefined })
    expect(next.title).toBe('B')
    expect(next).not.toHaveProperty('assignee')
    expect(next).not.toHaveProperty('due')
  })

  it('does not mutate the card', () => {
    applyLocal(card, { title: 'B' })
    expect(card.title).toBe('A')
  })
})

describe('columns', () => {
  it('sends unknown or missing statuses to the first column', () => {
    expect(statusOf(sprint, card)).toBe('todo')
    expect(statusOf(sprint, { ...card, status: 'gone' })).toBe('todo')
    expect(statusOf(sprint, { ...card, status: 'done' })).toBe('done')
  })

  it('knows the first and last column', () => {
    expect(firstColumn(sprint)).toBe('todo')
    expect(doneColumn(sprint)).toBe('done')
  })
})
