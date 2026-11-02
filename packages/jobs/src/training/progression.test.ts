import { describe, expect, it } from 'vitest'

import { repRange, suggestSets } from './progression.js'
import type { RoutineExercise } from './types.js'

const routine = (scheme: string, sets: RoutineExercise['sets'] = []): RoutineExercise => ({
  exercise: 'ed-0025',
  name: 'Bench',
  scheme,
  sets,
})

describe('repRange', () => {
  it.each([
    ['3×8-12 · 90s', { min: 8, max: 12 }],
    ['4x5', { min: 5, max: 5 }],
    ['8–10 reps', { min: 8, max: 10 }],
    ['AMRAP', null],
  ])('reads %s', (scheme, range) => {
    expect(repRange(scheme)).toEqual(range)
  })
})

describe('suggestSets', () => {
  const targets = [
    { kg: 60, reps: 8 },
    { kg: 60, reps: 8 },
    { kg: 60, reps: 8 },
  ]

  it('uses the routine targets the first time', () => {
    expect(suggestSets(routine('3×8-12', targets), [])).toEqual(targets)
  })

  it('adds 2.5 kg and goes back to the bottom of the range once every set hit the top', () => {
    const last = [
      { kg: 60, reps: 12 },
      { kg: 60, reps: 12 },
      { kg: 60, reps: 12 },
    ]
    expect(suggestSets(routine('3×8-12', targets), last)).toEqual([
      { kg: 62.5, reps: 8 },
      { kg: 62.5, reps: 8 },
      { kg: 62.5, reps: 8 },
    ])
  })

  it('adds 1 kg to light lifts', () => {
    const last = [{ kg: 10, reps: 15 }]
    expect(suggestSets(routine('1×12-15'), last)).toEqual([{ kg: 11, reps: 12 }])
  })

  it('repeats last time when a set fell short of the top', () => {
    const last = [
      { kg: 60, reps: 12 },
      { kg: 60, reps: 11 },
      { kg: 60, reps: 9 },
    ]
    expect(suggestSets(routine('3×8-12', targets), last)).toEqual(last)
  })

  it('never adds weight to a bodyweight exercise', () => {
    expect(suggestSets(routine('3×10'), [{ reps: 10 }, { reps: 10 }])).toEqual([{ reps: 10 }, { reps: 10 }])
  })
})
