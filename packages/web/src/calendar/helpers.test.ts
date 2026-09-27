import { describe, expect, it } from 'vitest'

import { ymd } from '../helpers/dates'
import type { CalendarItem } from '../types/calendar'
import type { Person } from '../types/people'
import {
  addMinutes,
  colorOf,
  daysBetween,
  daysOf,
  lanes,
  layoutDay,
  minuteOf,
  minutesBetween,
  rangeLabel,
  rangeOf,
  shiftDays,
  stepDate,
} from './helpers'

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: 'x',
  kind: 'event',
  title: 'x',
  start: '2026-09-28',
  end: '2026-09-28',
  allDay: true,
  ref: 'x.md',
  editable: true,
  ...over,
})

describe('wall-clock stamps', () => {
  it('adds minutes across midnight', () => {
    expect(addMinutes('2026-09-28T23:30', 45)).toBe('2026-09-29T00:15')
  })

  it('keeps wall-clock time across the spring DST change (Europe/Paris)', () => {
    expect(shiftDays('2026-03-28T09:00', 1)).toBe('2026-03-29T09:00')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('shifts all-day and timed values keeping their shape', () => {
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDays('2026-01-01T08:00', -1)).toBe('2025-12-31T08:00')
  })

  it('measures minutes and minute-of-day', () => {
    expect(minutesBetween('2026-09-28T09:00', '2026-09-28T10:30')).toBe(90)
    expect(minuteOf('2026-09-28T14:05')).toBe(845)
    expect(minuteOf('2026-09-28')).toBe(0)
  })
})

describe('daysOf', () => {
  it('covers all-day ranges inclusively', () => {
    expect(daysOf(item({ start: '2026-09-28', end: '2026-09-30' }))).toEqual(['2026-09-28', '2026-09-29', '2026-09-30'])
  })

  it('does not count a timed item ending at midnight on the next day', () => {
    const it2 = item({ allDay: false, start: '2026-09-28T22:00', end: '2026-09-29T00:00' })
    expect(daysOf(it2)).toEqual(['2026-09-28'])
  })

  it('counts a timed item running past midnight', () => {
    const it2 = item({ allDay: false, start: '2026-09-28T22:00', end: '2026-09-29T01:00' })
    expect(daysOf(it2)).toEqual(['2026-09-28', '2026-09-29'])
  })

  it('caps runaway ranges at a year', () => {
    expect(daysOf(item({ start: '2026-01-01', end: '2030-01-01' }))).toHaveLength(366)
  })
})

describe('rangeOf / stepDate / rangeLabel', () => {
  const thu = new Date(2026, 8, 24, 15, 0)

  it('starts weeks on Monday', () => {
    const { from, to, days } = rangeOf('week', thu)
    expect(ymd(from)).toBe('2026-09-21')
    expect(ymd(to)).toBe('2026-09-28')
    expect(days).toHaveLength(7)
  })

  it('shows six full weeks for a month', () => {
    const { from, days } = rangeOf('month', thu)
    expect(ymd(from)).toBe('2026-08-31')
    expect(days).toHaveLength(42)
  })

  it('shows a day and four weeks for the timeline', () => {
    expect(rangeOf('day', thu).days).toHaveLength(1)
    expect(rangeOf('timeline', thu).days).toHaveLength(28)
  })

  it('steps by the view size', () => {
    expect(ymd(stepDate('day', thu, 1))).toBe('2026-09-25')
    expect(ymd(stepDate('week', thu, -1))).toBe('2026-09-17')
    expect(ymd(stepDate('timeline', thu, 1))).toBe('2026-10-08')
    expect(ymd(stepDate('month', new Date(2026, 0, 31), 1))).toBe('2026-02-01')
  })

  it('labels ranges', () => {
    expect(rangeLabel('month', thu, [])).toBe('September 2026')
    expect(rangeLabel('day', thu, [thu])).toBe('24 September 2026')
    expect(rangeLabel('week', thu, rangeOf('week', thu).days)).toBe('21–27 Sep 2026')
    expect(rangeLabel('week', new Date(2026, 8, 30), rangeOf('week', new Date(2026, 8, 30)).days)).toBe(
      '28 Sep – 4 Oct 2026',
    )
  })
})

describe('layoutDay', () => {
  it('puts overlapping blocks side by side and gives the cluster its width', () => {
    const out = layoutDay([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 },
      { id: 'c', start: 120, end: 150 },
    ])
    expect(out.map((b) => [b.id, b.col, b.cols])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 1],
    ])
  })

  it('reuses a freed column inside a cluster', () => {
    const out = layoutDay([
      { id: 'a', start: 0, end: 30 },
      { id: 'b', start: 0, end: 120 },
      { id: 'c', start: 60, end: 90 },
    ])
    expect(out.find((b) => b.id === 'c')?.col).toBe(1)
    expect(out.every((b) => b.cols === 2)).toBe(true)
  })
})

describe('lanes', () => {
  it('stacks overlapping bars and reuses free lanes', () => {
    const out = lanes([
      { id: 'a', a: 0, b: 2 },
      { id: 'b', a: 1, b: 3 },
      { id: 'c', a: 3, b: 4 },
    ])
    expect(out.map((x) => [x.id, x.lane])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
    ])
  })
})

describe('colorOf', () => {
  const people: Person[] = [{ id: 'me', name: 'Me', color: '#f00' }]

  it('paints AI work purple', () => {
    expect(colorOf(item({ kind: 'job' }), people)).toBe('#8b5cf6')
    expect(colorOf(item({ kind: 'card-ai' }), people)).toBe('#8b5cf6')
  })

  it('uses the first person of an event, the assignee of a card', () => {
    expect(colorOf(item({ people: ['me'] }), people)).toBe('#f00')
    expect(colorOf(item({ kind: 'card', assignee: 'me' }), people)).toBe('#f00')
    expect(colorOf(item({ kind: 'card', assignee: 'nobody' }), people)).toBeUndefined()
  })
})
