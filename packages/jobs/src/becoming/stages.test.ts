import { describe, expect, it } from 'vitest'

import { addDays } from '../helpers/dates.js'
import { stageProgress } from './stages.js'
import type { DayVote, Identity } from './types.js'
import { voteKey } from './votes.js'

const identity = (over: Partial<Identity>): Identity => ({
  file: 'writer.md',
  statement: 'I am a writer',
  action: 'write',
  minutes: 30,
  signals: [{ files: 'Writing/' }],
  guards: [],
  stage: 'trying',
  since: '2026-08-01',
  stageSince: '2026-08-01',
  why: '',
  proof: [],
  extra: {},
  ...over,
})

/** Votes on the given days of each week, for `weeks` weeks ending on Sunday 2026-09-27. */
function votes(days: number[], weeks: number): Map<string, DayVote> {
  const out = new Map<string, DayVote>()
  for (let w = 0; w < weeks; w++) {
    const monday = addDays('2026-09-21', -7 * w)
    for (const d of days) out.set(voteKey(addDays(monday, d), 'writer.md'), { kind: 'full', source: 'auto' })
  }
  return out
}

describe('stageProgress', () => {
  it('counts an experiment in days', () => {
    const p = stageProgress(identity({ stage: 'experiment', stageSince: '2026-09-20' }), new Map(), '2026-09-28')
    expect(p).toMatchObject({ day: 9 })
    expect(p.suggest).toBeUndefined()
  })

  it('suggests Sticking after four steady weeks in a row', () => {
    expect(stageProgress(identity({}), votes([0, 2, 4], 4), '2026-09-28')).toMatchObject({
      weeks: 4,
      weeksNeeded: 4,
      suggest: 'sticking',
    })
    expect(stageProgress(identity({}), votes([0, 2], 4), '2026-09-28')).toMatchObject({ weeks: 0 })
  })

  it('stays quiet after a dismiss', () => {
    const p = stageProgress(identity({ quietUntil: '2026-10-05' }), votes([0, 2, 4], 4), '2026-09-28')
    expect(p.suggest).toBeUndefined()
  })

  it('asks five kept evenings a week of a guard identity', () => {
    const present = identity({
      stage: 'sticking',
      signals: [],
      guards: [{ label: 'Home', from: '19:00', to: '24:00' }],
    })
    expect(stageProgress(present, votes([0, 1, 2, 3], 3), '2026-09-28')).toMatchObject({ perWeek: 5, weeks: 0 })
    expect(stageProgress(present, votes([0, 1, 2, 3, 4], 3), '2026-09-28')).toMatchObject({ suggest: 'part' })
  })
})
