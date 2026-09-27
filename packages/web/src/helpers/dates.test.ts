import { describe, expect, it } from 'vitest'

import {
  addDays,
  ago,
  dayLabel,
  formatDateValue,
  isPastTime,
  notPastTime,
  relativeDayTime,
  shortDayTime,
  startOfWeek,
  timeSlots,
  until,
  ymd,
} from './dates'

const now = new Date(2026, 8, 24, 15, 0)

describe('dates and labels', () => {
  it('startOfWeek is Monday 00:00, also from a Sunday', () => {
    expect(startOfWeek(new Date(2026, 8, 27, 23, 0))).toEqual(new Date(2026, 8, 21))
  })

  it('addDays keeps the wall-clock time over DST', () => {
    expect(addDays(new Date(2026, 9, 24, 9, 0), 2)).toEqual(new Date(2026, 9, 26, 9, 0))
  })

  it('until', () => {
    expect(until(new Date(now.getTime() + 5 * 60_000), now)).toBe('in 5m')
    expect(until(new Date(now.getTime() + 168 * 60_000), now)).toBe('in 2h 48m')
    expect(until(new Date(now.getTime() + 50 * 3_600_000), now)).toBe('in 2d')
    expect(until(new Date(now.getTime() - 60_000), now)).toBe('in 0m')
  })

  it('ago', () => {
    expect(ago(now, now)).toBe('Now')
    expect(ago(new Date(now.getTime() - 12 * 60_000), now)).toBe('12 min ago')
    expect(ago(new Date(2026, 8, 24, 9, 0), now)).toBe('6 h ago')
    expect(ago(new Date(2026, 8, 23, 20, 0), now)).toBe('Yesterday')
    expect(ago(new Date(2026, 8, 20, 20, 0), now)).toBe('Sun 20 Sep')
  })

  it('dayLabel uses fixed English names', () => {
    expect(dayLabel(now)).toBe('Thu 24 Sep')
  })
})

describe('ymd', () => {
  it('formats a local date', () => {
    expect(ymd(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('relativeDayTime', () => {
  it('names today and tomorrow', () => {
    expect(relativeDayTime(new Date(2026, 8, 24, 9, 5), now)).toBe('Today 09:05')
    expect(relativeDayTime(new Date(2026, 8, 25, 9, 5), now)).toBe('Tomorrow 09:05')
    expect(relativeDayTime(new Date(2026, 8, 28, 9, 5), now)).toBe('Mon 28 Sep 09:05')
  })
})

describe('shortDayTime', () => {
  it('shows the time today, the weekday otherwise', () => {
    expect(shortDayTime('2026-09-24T09:05', now)).toBe('09:05')
    expect(shortDayTime('2026-09-28T09:05', now)).toBe('Mon 09:05')
    expect(shortDayTime('soon', now)).toBe('soon')
  })
})

describe('formatDateValue', () => {
  it('formats a date or a date-time value', () => {
    expect(formatDateValue('2026-10-02')).toBe('Fri 02 Oct 2026')
    expect(formatDateValue('2026-10-02T09:30', false)).toBe('Fri 02 Oct · 09:30')
    expect(formatDateValue(undefined)).toBe('')
  })
})

describe('times not in the past', () => {
  const nine = new Date(2026, 8, 27, 21, 0)
  it('today offers slots from now on, rounded up to the half hour', () => {
    expect(timeSlots(nine, nine)).toEqual(['21:00', '22:00', '23:00'])
    expect(timeSlots(nine, new Date(2026, 8, 27, 10, 5))).toEqual(['10:30', '11:30', '12:30', '13:30'])
  })
  it('later days keep the default slots, earlier days get none', () => {
    expect(timeSlots(addDays(nine, 1), nine)).toEqual(['09:00', '12:00', '15:00', '18:00'])
    expect(timeSlots(addDays(nine, -1), nine)).toEqual([])
    expect(timeSlots(nine)).toEqual(['09:00', '12:00', '15:00', '18:00'])
  })
  it('a passed time moves to the next slot, the current minute still counts', () => {
    expect(isPastTime(nine, '20:59', nine)).toBe(true)
    expect(isPastTime(nine, '21:00', new Date(2026, 8, 27, 21, 0, 40))).toBe(false)
    expect(notPastTime(nine, '09:00', nine)).toBe('21:00')
    expect(notPastTime(addDays(nine, 1), '09:00', nine)).toBe('09:00')
  })
})
