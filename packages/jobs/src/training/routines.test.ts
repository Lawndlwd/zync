import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { readProfile, saveProfile } from './profile.js'
import {
  createRoutine,
  dayOf,
  deleteRoutine,
  listRoutines,
  plannedOn,
  readRoutine,
  saveRoutine,
  updateRoutine,
} from './routines.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-training-'))
})

const squat = { exercise: 'ed-0043', name: 'Barbell Full Squat', scheme: '3×5' }

describe('routines', () => {
  it('is a page titled by its file, listed in week order', async () => {
    await createRoutine(ws, { name: 'Legs', days: ['Thu'], exercises: [squat] })
    const push = await createRoutine(ws, { name: 'Push Day', days: ['Tue', 'Mon', 'Mon'] })
    expect(push).toMatchObject({ file: 'Push Day.md', name: 'Push Day', days: ['Mon', 'Tue'], exercises: [] })
    expect((await listRoutines(ws)).map((r) => r.name)).toEqual(['Push Day', 'Legs'])
    const src = await readFile(path.join(ws, 'Training/Routines/Legs.md'), 'utf8')
    expect(src).toContain('exercise: ed-0043')
  })

  it('renames the file with the name, and keeps keys it does not manage', async () => {
    await createRoutine(ws, { name: 'Legs', exercises: [squat], notes: 'Go deep' })
    const renamed = await updateRoutine(ws, 'Legs.md', { name: 'Leg Day', days: ['Fri'] })
    expect(renamed).toMatchObject({ file: 'Leg Day.md', days: ['Fri'], notes: 'Go deep', exercises: [squat] })
    await expect(readRoutine(ws, 'Legs.md')).rejects.toMatchObject({ status: 404 })
  })

  it('replaces a routine saved again under the same name', async () => {
    await createRoutine(ws, { name: 'Legs', days: ['Mon'], exercises: [squat] })
    await saveRoutine(ws, { name: 'Legs', days: ['Wed'] })
    const all = await listRoutines(ws)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ days: ['Wed'], exercises: [squat] })
  })

  it('rejects unknown exercises and deletes', async () => {
    await expect(
      createRoutine(ws, { name: 'X', exercises: [{ exercise: 'squat', name: 'Squat' }] }),
    ).rejects.toMatchObject({ status: 400 })
    await createRoutine(ws, { name: 'Legs' })
    await deleteRoutine(ws, 'Legs.md')
    expect(await listRoutines(ws)).toEqual([])
  })

  it('knows which routine is planned on a day', async () => {
    const routines = [await createRoutine(ws, { name: 'Push', days: ['Tue'] })]
    expect(dayOf('2026-09-29')).toBe('Tue')
    expect(plannedOn(routines, '2026-09-29')?.name).toBe('Push')
    expect(plannedOn(routines, '2026-09-30')).toBeNull()
  })
})

describe('profile', () => {
  it('is missing until set up, then keeps its setup time and notes', async () => {
    expect(await readProfile(ws)).toBeNull()
    const made = await saveProfile(ws, {
      goal: 'strength',
      equipment: ['barbell', 'barbell'],
      daysPerWeek: 3,
      notes: 'Knee ok',
    })
    expect(made).toMatchObject({ units: 'kg', equipment: ['barbell'], notes: 'Knee ok' })
    const again = await saveProfile(ws, { goal: 'build_muscle', equipment: ['gym'], daysPerWeek: 4, units: 'lb' })
    expect(again).toMatchObject({ goal: 'build_muscle', setupAt: made.setupAt, notes: 'Knee ok' })
    expect(await readProfile(ws)).toEqual(again)
  })

  it('rejects a profile without equipment', async () => {
    await expect(saveProfile(ws, { goal: 'strength', equipment: [], daysPerWeek: 3 })).rejects.toThrow(/equipment/)
  })
})
