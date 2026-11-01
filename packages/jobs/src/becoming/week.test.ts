import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { appendActivity } from './activity.js'
import { castVote } from './cast.js'
import { createIdentity } from './store.js'
import { becomingWeek, isoWeek, weekMonday } from './week.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'becoming-week-'))
})

describe('ISO weeks', () => {
  it.each([
    ['2026-09-28', '2026-W40'],
    ['2026-09-27', '2026-W39'],
    ['2021-01-03', '2020-W53'],
    ['2026-01-01', '2026-W01'],
  ])('%s is in %s', (date, week) => {
    expect(isoWeek(date)).toBe(week)
  })

  it('finds the Monday of a week', () => {
    expect(weekMonday('2026-W39')).toBe('2026-09-21')
    expect(weekMonday('nope')).toBeNull()
  })
})

describe('becomingWeek', () => {
  it('adds up the time Zync saw, the votes, and meetings nobody claims', async () => {
    await createIdentity(
      ws,
      { statement: 'I am a writer', action: 'Write', signals: [{ files: 'Writing/' }] },
      '2026-09-01',
    )
    await createIdentity(
      ws,
      { statement: 'I am a runner', action: 'Run', signals: [{ event: 'run' }], stage: 'trying' },
      '2026-09-01',
    )
    await appendActivity(ws, [
      { t: '2026-09-22T07:10', path: 'Writing/Essay.md', kind: 'edit' },
      { t: '2026-09-22T07:20', path: 'Writing/Essay.md', kind: 'edit' },
    ])
    await castVote(ws, 'writer.md', '2026-09-22', 'full', 'tap')
    const external = [
      { title: 'Saturday run', start: '2026-09-26T10:10', end: '2026-09-26T10:45' },
      { title: 'Hiring panel', start: '2026-09-23T17:00', end: '2026-09-23T18:30' },
    ]
    const w = await becomingWeek(ws, '2026-W39', external, '2026-09-28T09:00')
    expect(w).toMatchObject({ week: '2026-W39', from: '2026-09-21', to: '2026-09-27', daysTracked: 7 })
    expect(w.identities.find((i) => i.file === 'writer.md')).toMatchObject({
      minutes: 15,
      votes: 1,
      full: 1,
      spans: [{ date: '2026-09-22', start: '07:10', end: '07:25' }],
    })
    expect(w.identities.find((i) => i.file === 'runner.md')?.minutes).toBe(35)
    expect(w.unclaimed).toMatchObject({
      minutes: 90,
      events: [{ title: 'Hiring panel', minutes: 90, recurring: false }],
    })
    expect(w.trackedMinutes).toBe(140)
  })

  it('counts only the days so far of a week in progress', async () => {
    expect((await becomingWeek(ws, '2026-W40', [], '2026-09-30T12:00')).daysTracked).toBe(3)
  })
})
