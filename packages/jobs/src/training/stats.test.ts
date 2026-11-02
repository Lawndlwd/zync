import { describe, expect, it } from 'vitest'

import { bestOf, durationMin, e1rm, streakOf, tonnage, volumeOf } from './stats.js'
import type { WorkoutExercise } from './types.js'

const bench = (sets: WorkoutExercise['sets']): WorkoutExercise => ({ exercise: 'ed-0025', name: 'Bench', sets })

describe('volume', () => {
  it('sums kg × reps over done sets, leaving warm-ups and skipped sets out', () => {
    const e = bench([
      { kg: 40, reps: 10, done: true, warmup: true },
      { kg: 60, reps: 8, done: true },
      { kg: 60, reps: 7, done: true },
      { kg: 60, reps: 6, done: false },
    ])
    expect(volumeOf([e])).toBe(900)
  })

  it('counts a set without weight as nothing', () => {
    expect(volumeOf([bench([{ reps: 12, done: true }])])).toBe(0)
  })
})

describe('e1RM', () => {
  it('uses Epley, and a single is the weight itself', () => {
    expect(e1rm(100, 5)).toBe(116.7)
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(0, 10)).toBe(0)
  })

  it('picks the set with the best estimate', () => {
    expect(bestOf([{ kg: 100, reps: 3 }, { kg: 90, reps: 8 }, { reps: 20 }])).toEqual({ kg: 90, reps: 8, e1rm: 114 })
    expect(bestOf([{ reps: 20 }])).toBeNull()
  })
})

describe('streak', () => {
  const days = new Set(['2026-09-26', '2026-09-27', '2026-09-28'])

  it('counts back from today', () => {
    expect(streakOf(new Set([...days, '2026-09-29']), '2026-09-29')).toBe(4)
  })

  it('still counts through yesterday when today has no workout yet', () => {
    expect(streakOf(days, '2026-09-29')).toBe(3)
  })

  it('is broken by a day off before yesterday', () => {
    expect(streakOf(days, '2026-09-30')).toBe(0)
  })
})

describe('labels', () => {
  it('measures a workout in minutes, 0 while running', () => {
    expect(durationMin({ startedAt: '2026-09-29T17:00:00.000Z', endedAt: '2026-09-29T17:48:20.000Z' })).toBe(48)
    expect(durationMin({ startedAt: '2026-09-29T17:00:00.000Z' })).toBe(0)
  })

  it('writes tonnes from a tonne up', () => {
    expect(tonnage(6240)).toBe('6.2 t')
    expect(tonnage(850)).toBe('850 kg')
  })
})
