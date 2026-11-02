import { describe, expect, it } from 'vitest'

import { dayMode } from './day-mode.js'

const m = (from: string, to: string) => ({ title: 'x', start: `2026-09-28T${from}`, end: `2026-09-28T${to}` })

describe('dayMode', () => {
  it('is open with no meetings', () => {
    expect(dayMode([], '2026-09-28')).toEqual({ mode: 'open', meetings: 0, longestGap: 720, reason: 'No meetings' })
  })

  it('is heavy with five meetings or more', () => {
    const day = [
      m('09:00', '09:30'),
      m('10:00', '10:30'),
      m('11:00', '11:30'),
      m('14:00', '14:30'),
      m('16:00', '16:30'),
    ]
    expect(dayMode(day, '2026-09-28').mode).toBe('heavy')
  })

  it('is heavy when no gap reaches 45 minutes', () => {
    const day = [m('07:00', '09:30'), m('10:00', '13:00'), m('13:25', '19:00')]
    expect(dayMode(day, '2026-09-28')).toMatchObject({
      mode: 'heavy',
      longestGap: 30,
      reason: '3 meetings, longest gap 30 min',
    })
  })

  it('ignores other days', () => {
    expect(dayMode([{ title: 'x', start: '2026-09-29T09:00', end: '2026-09-29T10:00' }], '2026-09-28').meetings).toBe(0)
  })
})
