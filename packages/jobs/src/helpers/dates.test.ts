import { describe, expect, it } from 'vitest'

import { addDays, addMinutes, daysApart, localStamp, mondayOf, WHEN_RE, wallClockField } from './dates.js'

describe('wall-clock arithmetic', () => {
  it('adds minutes across midnight', () => {
    expect(addMinutes('2026-09-28T23:30', 45)).toBe('2026-09-29T00:15')
  })

  it('adds minutes to a day (from midnight)', () => {
    expect(addMinutes('2026-09-28', 90)).toBe('2026-09-28T01:30')
  })

  it('adds days across a DST change without shifting', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('counts days between dates', () => {
    expect(daysApart('2026-09-28', '2026-10-02')).toBe(4)
  })

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-10-04')).toBe('2026-09-28')
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
  })
})

describe('localStamp', () => {
  it('formats a moment in a timezone', () => {
    expect(localStamp(new Date('2026-09-28T12:05:00Z'), 'Europe/Paris')).toBe('2026-09-28T14:05')
  })
})

describe('wallClockField', () => {
  const field = wallClockField(WHEN_RE, 'bad')

  it('turns a YAML date at midnight into a day', () => {
    expect(field.parse(new Date('2026-09-28T00:00:00Z'))).toBe('2026-09-28')
  })

  it('turns a YAML date-time into a local stamp', () => {
    expect(field.parse(new Date('2026-09-28T15:14:00Z'))).toBe('2026-09-28T15:14')
  })

  it('rejects other strings', () => {
    expect(field.safeParse('next week').success).toBe(false)
  })
})
