import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { finishWorkout } from './finish.js'
import { createRoutine } from './routines.js'
import type { WorkoutExercise } from './types.js'
import { activeWorkout, deleteWorkout, listWorkouts, readWorkout, startWorkout, updateWorkout } from './workouts.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-training-'))
})

const push = {
  name: 'Push Day',
  days: ['Mon' as const, 'Thu' as const],
  exercises: [
    {
      exercise: 'ed-0025',
      name: 'Barbell Bench Press',
      scheme: '2×8-12 · 90s',
      rest: 90,
      sets: [
        { kg: 60, reps: 8 },
        { kg: 60, reps: 8 },
      ],
    },
  ],
}

/** Every planned set done at the weight and reps it suggests, or at `reps`. */
const doAll = (exercises: WorkoutExercise[], reps?: number): WorkoutExercise[] =>
  exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, reps: reps ?? s.reps, done: true })) }))

async function session(start: string, end: string, reps?: number) {
  const w = await startWorkout(ws, { routine: 'Push Day.md' }, new Date(start))
  await updateWorkout(ws, w.file, { exercises: doAll(w.exercises, reps) })
  return finishWorkout(ws, w.file, new Date(end))
}

describe('workouts', () => {
  it('starts from a routine with its targets, one at a time', async () => {
    await createRoutine(ws, push)
    const w = await startWorkout(ws, { routine: 'Push Day.md' }, new Date('2026-09-28T12:00:00Z'))
    expect(w.file).toBe('2026-09-28-push-day.md')
    expect(w.name).toBe('Push Day')
    expect(w.exercises[0]).toMatchObject({
      rest: 90,
      sets: [
        { kg: 60, reps: 8, done: false },
        { kg: 60, reps: 8, done: false },
      ],
    })
    await expect(startWorkout(ws)).rejects.toMatchObject({ status: 409 })
    expect((await activeWorkout(ws))?.file).toBe(w.file)
    const src = await readFile(path.join(ws, 'Training/Log', w.file), 'utf8')
    expect(src).toContain('routine: Push Day.md')
    expect(src).not.toContain('endedAt')
  })

  it('finishes with records, then suggests more weight once the range is topped', async () => {
    await createRoutine(ws, push)
    const first = await session('2026-09-21T12:00:00Z', '2026-09-21T12:50:00Z', 12)
    expect(first.prs).toEqual([{ exercise: 'ed-0025', name: 'Barbell Bench Press', kg: 60, reps: 12, e1rm: 84 }])
    expect(first.workout.endedAt).toBe('2026-09-21T12:50:00.000Z')
    await expect(finishWorkout(ws, first.workout.file)).rejects.toMatchObject({ status: 409 })

    const next = await startWorkout(ws, { routine: 'Push Day.md' }, new Date('2026-09-24T12:00:00Z'))
    expect(next.exercises[0]?.sets.map((s) => [s.kg, s.reps])).toEqual([
      [62.5, 8],
      [62.5, 8],
    ])
    expect(next.previous['ed-0025']).toEqual([
      { kg: 60, reps: 12 },
      { kg: 60, reps: 12 },
    ])
    await updateWorkout(ws, next.file, { exercises: doAll(next.exercises, 10), notes: 'Felt strong' })
    const done = await finishWorkout(ws, next.file, new Date('2026-09-24T12:45:00Z'))
    expect(done.prs).toEqual([]) // 62.5 × 10 ≈ 83.3 < 84
    expect((await readWorkout(ws, next.file)).notes).toBe('Felt strong')

    const third = await session('2026-09-28T12:00:00Z', '2026-09-28T12:40:00Z', 12)
    expect(third.prs).toEqual([
      { exercise: 'ed-0025', name: 'Barbell Bench Press', kg: 62.5, reps: 12, e1rm: 87.5, previousE1rm: 84 },
    ])
  })

  it('lists a month with duration, volume and muscles, and deletes', async () => {
    await createRoutine(ws, push)
    const { workout } = await session('2026-09-21T12:00:00Z', '2026-09-21T12:50:00Z', 10)
    const list = await listWorkouts(ws, '2026-09')
    expect(list).toEqual([
      {
        file: workout.file,
        name: 'Push Day',
        date: '2026-09-21',
        durationMin: 50,
        exercises: 1,
        sets: 2,
        volumeKg: 1200,
        muscles: ['Chest'],
        active: false,
      },
    ])
    expect(await listWorkouts(ws, '2026-10')).toEqual([])
    await deleteWorkout(ws, workout.file)
    await expect(readWorkout(ws, workout.file)).rejects.toMatchObject({ status: 404 })
  })

  it('refuses paths outside the log', async () => {
    await expect(readWorkout(ws, '../profile.md')).rejects.toMatchObject({ status: 404 })
  })
})
