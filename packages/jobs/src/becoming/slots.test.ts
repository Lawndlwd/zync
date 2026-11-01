import { describe, expect, it } from 'vitest'

import { placeSlots } from './slots.js'
import type { Identity } from './types.js'

const identity = (file: string, over: Partial<Identity>): Identity => ({
  file,
  statement: file,
  action: 'do it',
  small: 'a bit',
  minutes: 30,
  signals: [{ manual: true }],
  guards: [],
  stage: 'trying',
  since: '2026-09-01',
  stageSince: '2026-09-01',
  why: '',
  proof: [],
  extra: {},
  ...over,
})
const m = (from: string, to: string) => ({ title: 'x', start: `2026-09-28T${from}`, end: `2026-09-28T${to}` })

describe('placeSlots', () => {
  it('puts an identity in the first free gap of its window', () => {
    const s = placeSlots([identity('writer.md', { when: 'morning' })], [m('06:30', '07:10')], '2026-09-28', false)
    expect(s).toEqual([{ identity: 'writer.md', start: '2026-09-28T07:10', end: '2026-09-28T07:40' }])
  })

  it('slides a fixed time past a meeting and says where from', () => {
    const s = placeSlots([identity('runner.md', { when: '18:00' })], [m('17:00', '18:30')], '2026-09-28', false)
    expect(s).toEqual([
      { identity: 'runner.md', start: '2026-09-28T18:30', end: '2026-09-28T19:00', movedFrom: '18:00' },
    ])
  })

  it('asks only for 10 minutes on a heavy day', () => {
    const s = placeSlots([identity('runner.md', { when: '18:00' })], [], '2026-09-28', true)
    expect(s[0]?.end).toBe('2026-09-28T18:10')
  })

  it('shows a guard identity as its window and places nothing inside a guard', () => {
    const present = identity('present.md', { signals: [], guards: [{ label: 'Home', from: '19:00', to: '24:00' }] })
    const s = placeSlots(
      [present, identity('runner.md', { when: '19:30' }), identity('reader.md', { when: 'evening' })],
      [],
      '2026-09-28',
      false,
    )
    expect(s).toEqual([
      { identity: 'reader.md', start: '2026-09-28T17:00', end: '2026-09-28T17:30' },
      { identity: 'present.md', start: '2026-09-28T19:00', end: '2026-09-28T23:59', guard: true },
    ])
  })
})
