import { describe, expect, it } from 'vitest'

import type { Board, Card } from '../types/boards'
import type { JobRow } from '../types/jobs'
import type { WorkspaceData } from '../types/workspace'
import { onboardingSteps, stepGuide } from './onboarding'

const board: Board = { path: 'Sprint', name: 'Sprint', columns: [{ id: 'todo', name: 'To do' }] }
const card = (over: Partial<Card>): Card => ({
  file: 'Task.md',
  title: 'Task',
  labels: [],
  context: [],
  description: '',
  extra: {},
  ...over,
})
const file = (path: string) => ({
  name: path.split('/').at(-1) ?? path,
  path,
  type: 'file' as const,
  size: 1,
  mtime: 1,
})
const empty: WorkspaceData = { jobs: [], boards: [], cards: [], runs: [], recent: [], fileCount: 0, people: [] }
const job = (over: Partial<NonNullable<JobRow['job']>>): JobRow => ({
  name: 'weekly',
  nextRuns: [],
  lastRun: null,
  job: { name: 'weekly', context: [], notify: 'always', enabled: true, instructions: 'x', ...over },
})

const doneIds = (data: WorkspaceData, memories = 0, paletteSeen = false) =>
  onboardingSteps({ data, memories, paletteSeen })
    .filter((s) => s.done)
    .map((s) => s.id)

describe('onboardingSteps', () => {
  it('starts with nothing done', () => {
    expect(doneIds(empty)).toEqual([])
  })

  it('counts a page, but not a card or a calendar event', () => {
    const cards = [{ board, card: card({}), ref: 'Sprint/Task.md' }]
    expect(doneIds({ ...empty, cards, recent: [file('Sprint/Task.md'), file('Calendar/Sync.md')] })).not.toContain(
      'page',
    )
    expect(doneIds({ ...empty, recent: [file('notes/Plan.md')] })).toContain('page')
  })

  it('ticks a board, an @ai card, a job, a memory and the palette', () => {
    const data: WorkspaceData = {
      ...empty,
      boards: [board],
      cards: [{ board, card: card({ assignee: 'ai' }), ref: 'Sprint/Task.md' }],
      jobs: [job({})],
    }
    expect(doneIds(data, 1, true)).toEqual(['board', 'ai-card', 'job', 'memory', 'palette'])
  })

  it("doesn't count a card's own job as a scheduled job", () => {
    expect(doneIds({ ...empty, jobs: [job({ card: 'Sprint/Task.md' })] })).not.toContain('job')
  })
})

describe('stepGuide', () => {
  it('sends the @ai step to the first board, or to create one', () => {
    expect(stepGuide('ai-card', 'w', { ...empty, boards: [board] }).to).toBe('/w/w/boards/Sprint')
    expect(stepGuide('ai-card', 'w', empty).tip.target).toBe('[data-tour="new-board"]')
  })
})
