import { describe, expect, it } from 'vitest'

import { evidenceFor, isManual } from './evidence.js'
import type { Activity, Identity, WorkoutDone } from './types.js'

const identity = (over: Partial<Identity>): Identity => ({
  file: 'writer.md',
  statement: 'I am a writer',
  action: 'Write 300 words',
  minutes: 30,
  signals: [],
  guards: [],
  stage: 'trying',
  since: '2026-09-01',
  stageSince: '2026-09-01',
  why: '',
  proof: [],
  extra: {},
  ...over,
})
const facts = (
  activity: Activity[],
  now = '2026-09-28T23:00',
  events = [] as Array<{ title: string; start: string; end: string }>,
) => ({
  date: '2026-09-28',
  activity,
  events,
  now,
})
const card = (kind: Activity['kind'], labels: string[]): Activity => ({
  t: '2026-09-28T15:00',
  path: 'ideas/Blog habits.md',
  kind,
  labels,
})
const edit = (t: string, path: string): Activity => ({ t: `2026-09-28T${t}`, path, kind: 'edit' })
const workout = (minutes: number, date = '2026-09-28'): WorkoutDone => ({
  date,
  start: '18:00',
  end: '19:00',
  name: 'Push Day',
  minutes,
  volumeKg: 6240,
})

describe('evidenceFor', () => {
  const writer = identity({ signals: [{ files: 'Writing/' }] })

  it('counts a finished workout that day, full from its minimum length', () => {
    const trainer = identity({ signals: [{ workout: { minMinutes: 30 } }] })
    expect(evidenceFor(trainer, { ...facts([]), workouts: [workout(48)] })).toEqual({
      kind: 'full',
      note: 'Push Day · 48 min · 6.2 t',
    })
    expect(evidenceFor(trainer, { ...facts([]), workouts: [workout(20)] })?.kind).toBe('small')
    expect(evidenceFor(trainer, { ...facts([]), workouts: [workout(48, '2026-09-27')] })).toBeNull()
    expect(evidenceFor(identity({ signals: [{ workout: {} }] }), { ...facts([]), workouts: [workout(20)] })?.kind).toBe(
      'full',
    )
  })

  it('counts time spent in the folder: full past the identity minutes', () => {
    const times = ['07:10', '07:18', '07:26', '07:35']
    const e = evidenceFor(writer, facts(times.map((t) => edit(t, 'Writing/Essay.md'))))
    expect(e).toEqual({ kind: 'full', note: '30 min in Essay.md' })
  })

  it('is a small vote below the minutes, and nothing outside the folder', () => {
    expect(evidenceFor(writer, facts([edit('07:10', 'Writing/Essay.md')]))?.kind).toBe('small')
    expect(evidenceFor(writer, facts([edit('07:10', 'Code/app.ts')]))).toBeNull()
  })

  it('takes a finished calendar event whose title matches', () => {
    const runner = identity({ signals: [{ event: 'run' }] })
    const run = { title: 'Morning run', start: '2026-09-28T10:00', end: '2026-09-28T10:45' }
    expect(evidenceFor(runner, facts([], '2026-09-28T09:00', [run]))).toBeNull()
    expect(evidenceFor(runner, facts([], '2026-09-28T11:00', [run]))).toEqual({
      kind: 'full',
      note: '“Morning run” at 10:00',
    })
  })

  it('counts a labeled card done as full and moved as small', () => {
    const builder = identity({ signals: [{ card: { label: 'essay' } }] })
    expect(evidenceFor(builder, facts([card('card-done', ['essay'])]))).toEqual({
      kind: 'full',
      note: 'card “Blog habits” → done',
    })
    expect(evidenceFor(builder, facts([card('card-moved', ['essay'])]))?.kind).toBe('small')
    expect(evidenceFor(builder, facts([card('card-done', ['other'])]))).toBeNull()
  })

  it('keeps a guard once its window is over with nothing done inside', () => {
    const present = identity({ guards: [{ label: 'Present at home', from: '19:00', to: '24:00' }] })
    expect(evidenceFor(present, facts([], '2026-09-28T22:00'))).toBeNull()
    expect(evidenceFor(present, { ...facts([]), now: '2026-09-29T03:00' })).toEqual({
      kind: 'full',
      note: 'Present at home kept',
    })
    expect(evidenceFor(present, { ...facts([edit('21:00', 'Code/app.ts')]), now: '2026-09-29T03:00' })).toBeNull()
  })

  it('knows which identities only the user can vote', () => {
    expect(isManual(identity({ signals: [{ manual: true }] }))).toBe(true)
    expect(isManual(identity({}))).toBe(true)
    expect(isManual(writer)).toBe(false)
  })
})
