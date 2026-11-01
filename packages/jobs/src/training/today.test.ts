import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { addBodyWeight } from './body-weight.js'
import { logWorkout } from './finish.js'
import { saveProfile } from './profile.js'
import { trainingProgress } from './progress.js'
import { buildTrainingPrompt } from './prompt.js'
import { createRoutine } from './routines.js'
import { trainingToday } from './today.js'
import { startWorkout } from './workouts.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-training-'))
})

const bench = (kg: number, reps: number) => [
  {
    exercise: 'ed-0025',
    sets: [
      { kg, reps },
      { kg, reps },
    ],
  },
]

describe('trainingToday', () => {
  it('shows the planned routine, the week, the streak and the workout in progress', async () => {
    await saveProfile(ws, { goal: 'strength', equipment: ['barbell'], daysPerWeek: 3 })
    await createRoutine(ws, { name: 'Push', days: ['Mon', 'Wed'] })
    await createRoutine(ws, { name: 'Pull', days: ['Tue'] })
    await logWorkout(ws, { date: '2026-09-28', time: '10:00', exercises: bench(100, 5) })
    await logWorkout(ws, { date: '2026-09-27', time: '10:00', exercises: bench(100, 5) })
    const today = await trainingToday(ws, '2026-09-29')
    expect(today).toMatchObject({ profile: true, planned: { name: 'Pull' }, active: null, streak: 2 })
    expect(today.week).toMatchObject({ volumeKg: 1000, done: 1, planned: 3 })
    expect(today.week.days.map((d) => d.trained)).toEqual([true, false, false, false, false, false, false])

    const running = await startWorkout(ws)
    expect((await trainingToday(ws, '2026-09-29')).active?.file).toBe(running.file)
  })

  it('says when the profile is missing', async () => {
    expect(await trainingToday(ws, '2026-09-29')).toMatchObject({ profile: false, planned: null, streak: 0 })
  })
})

describe('trainingProgress', () => {
  it('buckets volume by week, lists records and the body weight', async () => {
    await logWorkout(ws, { date: '2026-09-14', exercises: bench(100, 5) })
    await logWorkout(ws, { date: '2026-09-28', exercises: bench(105, 5) })
    await logWorkout(ws, { date: '2026-01-05', exercises: bench(80, 5) })
    await addBodyWeight(ws, { kg: 81, date: '2026-09-20' })
    await addBodyWeight(ws, { kg: 80.5, date: '2026-09-20' })
    const p = await trainingProgress(ws, '8w', '2026-09-29')
    expect(p.volume).toHaveLength(8)
    expect(p.volume.at(-1)).toEqual({ label: '28 Sep', kg: 1050 })
    expect(p.volume.at(-3)).toEqual({ label: '14 Sep', kg: 1000 })
    expect(p.prs.map((r) => [r.date, r.e1rm, r.delta])).toEqual([
      ['2026-09-28', 122.5, 5.8],
      ['2026-09-14', 116.7, 23.4],
    ])
    expect(p.body).toEqual([{ date: '2026-09-20', kg: 80.5 }])
    const all = await trainingProgress(ws, 'all', '2026-09-29')
    expect(all.volume[0]).toEqual({ label: 'Jan 2026', kg: 800 })
    expect(all.volume).toHaveLength(9)
  })
})

describe('buildTrainingPrompt', () => {
  it('is empty before setup, then gives the goal and today', async () => {
    expect(await buildTrainingPrompt(ws)).toBe('')
    await saveProfile(ws, { goal: 'build_muscle', equipment: ['dumbbells'], daysPerWeek: 4 })
    await createRoutine(ws, { name: 'Upper', days: ['Tue'] })
    const prompt = await buildTrainingPrompt(ws, '2026-09-29T08:00')
    expect(prompt).toContain('build muscle · 4 days/week')
    expect(prompt).toContain('Today (Tue): Upper')
  })
})
