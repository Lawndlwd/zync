import { describe, expect, it } from 'vitest'

import type { LoggedSet, Routine, WorkoutExercise } from '../types/training'
import {
  amountFrom,
  byFolder,
  clockLabel,
  completeSet,
  daysText,
  deltaLabel,
  draftOf,
  elapsedSeconds,
  extendRest,
  fromUnits,
  minutesLabel,
  monthCells,
  monthLabel,
  moveItem,
  nextSet,
  parseAmount,
  previousText,
  profileOf,
  restLeft,
  routineSummary,
  setProgress,
  setsText,
  shares,
  shiftMonth,
  stepProblem,
  toggleDay,
  toUnits,
  trendPoints,
  volumeLabel,
  volumeOf,
  weekCells,
  weekdayOf,
  weightLabel,
  weightText,
  withAmount,
} from './training'

const routine = (over: Partial<Routine> = {}): Routine => ({
  file: 'push.md',
  name: 'Push',
  days: ['Mon'],
  exercises: [],
  notes: '',
  ...over,
})

const exercise = (sets: LoggedSet[]): WorkoutExercise => ({ exercise: 'ed-1', name: 'Bench press', sets })

describe('kg and lb', () => {
  it('shows stored kg in the user’s units', () => {
    expect(weightText(82.5, 'kg')).toBe('82.5')
    expect(weightText(100, 'lb')).toBe('220.5')
    expect(weightText(undefined, 'kg')).toBe('')
    expect(weightLabel(60, 'kg')).toBe('60 kg')
  })

  it('stores a typed pound value as kg that reads back the same', () => {
    const kg = fromUnits(100, 'lb')
    expect(kg).toBeCloseTo(45.359, 3)
    expect(weightText(kg, 'lb')).toBe('100')
    expect(fromUnits(80, 'kg')).toBe(80)
    expect(toUnits(1, 'lb')).toBeCloseTo(2.2046, 4)
  })

  it('writes volume in kg, tonnes or pounds', () => {
    expect(volumeLabel(850, 'kg')).toBe('850 kg')
    expect(volumeLabel(6240, 'kg')).toBe('6.2 t')
    expect(volumeLabel(1000, 'lb')).toBe('2,205 lb')
  })

  it('signs a change', () => {
    expect(deltaLabel(2.5, 'kg')).toBe('+2.5 kg')
    expect(deltaLabel(-1, 'kg')).toBe('−1 kg')
  })

  it('reads typed amounts, with a comma too', () => {
    expect(parseAmount('82,5')).toBe(82.5)
    expect(parseAmount(' 8 ')).toBe(8)
    expect(parseAmount('')).toBeUndefined()
    expect(parseAmount('abc')).toBeUndefined()
    expect(parseAmount('-3')).toBeUndefined()
    expect(amountFrom('8.4', 'reps', 'kg')).toBe(8)
    expect(amountFrom('100', 'kg', 'lb')).toBeCloseTo(45.359, 3)
  })

  it('replaces or removes a set’s weight', () => {
    expect(withAmount({ kg: 80, reps: 8, done: false }, 'kg', 82.5)).toEqual({ kg: 82.5, reps: 8, done: false })
    expect(withAmount({ kg: 80, reps: 8 }, 'kg', undefined)).toEqual({ reps: 8 })
  })
})

describe('a workout in numbers', () => {
  it('counts volume over done working sets only', () => {
    const e = exercise([
      { kg: 40, reps: 10, done: true, warmup: true },
      { kg: 80, reps: 8, done: true },
      { kg: 80, reps: 6, done: false },
    ])
    expect(volumeOf([e])).toBe(640)
    expect(setProgress([e])).toEqual({ done: 2, total: 3 })
  })

  it('adds a set like the last one, not done', () => {
    expect(nextSet([{ kg: 80, reps: 8, done: true }])).toEqual({ kg: 80, reps: 8, done: false })
    expect(nextSet([])).toEqual({ done: false })
  })

  it('fills a ticked-off set from last time when left blank', () => {
    expect(completeSet({ done: false }, { kg: 80, reps: 8 })).toEqual({ kg: 80, reps: 8, done: true })
    expect(completeSet({ kg: 85, done: false }, { kg: 80, reps: 8 })).toEqual({ kg: 85, reps: 8, done: true })
    expect(completeSet({ done: false }, undefined)).toEqual({ done: true })
  })

  it('writes the previous set and a set list', () => {
    expect(previousText({ kg: 80, reps: 8 }, 'kg')).toBe('80 kg × 8')
    expect(previousText({ reps: 12 }, 'kg')).toBe('12 reps')
    expect(previousText(undefined, 'kg')).toBe('—')
    expect(
      setsText(
        [
          { kg: 80, reps: 8, done: true },
          { reps: 10, done: true },
          { kg: 20, reps: 5, done: true, warmup: true },
        ],
        'kg',
      ),
    ).toBe('80×8 · 10 reps')
    expect(setsText([{ done: false }], 'kg')).toBe('no sets done')
  })
})

describe('clocks and rest', () => {
  it('formats elapsed time', () => {
    expect(clockLabel(65)).toBe('1:05')
    expect(clockLabel(3725)).toBe('1:02:05')
    expect(clockLabel(-3)).toBe('0:00')
    expect(elapsedSeconds('2026-09-29T10:00:00Z', Date.parse('2026-09-29T10:02:30Z'))).toBe(150)
    expect(minutesLabel(48)).toBe('48 min')
    expect(minutesLabel(72)).toBe('1 h 12')
  })

  it('computes rest left from the end moment, rounding up', () => {
    expect(restLeft(10_000, 0)).toBe(10)
    expect(restLeft(10_000, 9_001)).toBe(1)
    expect(restLeft(10_000, 12_000)).toBe(0)
  })

  it('extends running rest, and restarts from now once it ran out', () => {
    expect(extendRest(10_000, 5_000, 15)).toBe(25_000)
    expect(extendRest(10_000, 20_000, 15)).toBe(35_000)
  })
})

describe('days and weeks', () => {
  it('names the weekday of a date, Monday first', () => {
    expect(weekdayOf('2026-09-28')).toBe('Mon')
    expect(weekdayOf('2026-10-04')).toBe('Sun')
  })

  it('marks trained, planned, today and future days on the strip', () => {
    const days = ['2026-09-28', '2026-09-29', '2026-09-30'].map((date, i) => ({ date, trained: i === 0 }))
    const cells = weekCells(days, '2026-09-29', [routine({ days: ['Mon', 'Wed'] })])
    expect(cells.map((c) => [c.day, c.n, c.trained, c.planned, c.today, c.future])).toEqual([
      ['Mon', 28, true, true, false, false],
      ['Tue', 29, false, false, true, false],
      ['Wed', 30, false, true, false, true],
    ])
  })

  it('writes and toggles days in week order', () => {
    expect(daysText(['Thu', 'Mon'])).toBe('Mon · Thu')
    expect(daysText([])).toBe('Any day')
    expect(toggleDay(['Thu'], 'Mon')).toEqual(['Mon', 'Thu'])
    expect(toggleDay(['Mon', 'Thu'], 'Mon')).toEqual(['Thu'])
  })
})

describe('routines', () => {
  it('sums up a routine', () => {
    const r = routine({
      days: ['Thu', 'Mon'],
      exercises: [{ exercise: 'ed-1', name: 'Bench', scheme: '3×8', sets: [{}, {}, {}] }],
    })
    expect(routineSummary(r)).toBe('1 exercise · 3 sets · Mon · Thu')
  })

  it('groups by folder, unfiled last', () => {
    const groups = byFolder([
      routine({ file: 'b.md', name: 'B' }),
      routine({ file: 'l.md', name: 'Legs', folder: 'PPL' }),
      routine({ file: 'a.md', name: 'A' }),
      routine({ file: 'c.md', name: 'Arms', folder: 'Extra' }),
    ])
    expect(groups.map((g) => [g.folder, g.routines.map((r) => r.name)])).toEqual([
      ['Extra', ['Arms']],
      ['PPL', ['Legs']],
      ['', ['A', 'B']],
    ])
  })

  it('moves an item, ignoring moves off the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('the month calendar', () => {
  it('shifts and names months', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(monthLabel('2026-09')).toBe('September 2026')
  })

  it('covers the month in whole Monday-first weeks', () => {
    const cells = monthCells('2026-09')
    expect(cells.length % 7).toBe(0)
    expect(cells[0]).toEqual({ date: '2026-08-31', inMonth: false })
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30)
    expect(cells.at(-1)).toEqual({ date: '2026-10-04', inMonth: false })
  })
})

describe('charts', () => {
  it('scales values to the largest', () => {
    expect(shares([0, 5, 10])).toEqual([0, 0.5, 1])
    expect(shares([0, 0])).toEqual([0, 0])
  })

  it('lays a trend out inside the box, highest at the top', () => {
    expect(trendPoints([1, 3], 100, 50, 0)).toBe('0,50 100,0')
    expect(trendPoints([2, 2], 100, 50, 0)).toBe('0,25 100,25')
    expect(trendPoints([], 100, 50)).toBe('')
  })
})

describe('the setup form', () => {
  const year = 2026

  it('asks for a goal, equipment and days before moving on', () => {
    const d = draftOf(null)
    expect(stepProblem(0, d, year)).toBeNull()
    expect(stepProblem(0, { ...d, birthYear: '3000' }, year)).toMatch(/Birth year/)
    expect(stepProblem(1, d, year)).toMatch(/goal/)
    expect(stepProblem(2, d, year)).toMatch(/equipment/)
    expect(stepProblem(3, d, year)).toMatch(/days/)
  })

  it('builds the profile, leaving blank answers out', () => {
    const d = { ...draftOf(null), goal: 'strength' as const, equipment: ['barbell' as const], daysPerWeek: 3 }
    expect(profileOf(draftOf(null))).toBeNull()
    expect(profileOf({ ...d, heightCm: '180', injuries: '  ' })).toEqual({
      goal: 'strength',
      equipment: ['barbell'],
      daysPerWeek: 3,
      units: 'kg',
      heightCm: 180,
    })
  })

  it('fills the form back from a saved profile', () => {
    const d = draftOf({
      goal: 'build_muscle',
      equipment: ['gym'],
      daysPerWeek: 4,
      units: 'lb',
      birthYear: 1990,
      setupAt: '2026-09-01T00:00:00Z',
      notes: '',
    })
    expect(d).toMatchObject({ goal: 'build_muscle', units: 'lb', birthYear: '1990', heightCm: '', daysPerWeek: 4 })
  })
})
