import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { createCustomExercise } from './custom-exercises.js'
import { ownedEquipment } from './equipment.js'
import { assertKnownExercises, getExercise, searchExercises } from './exercises.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-training-'))
})

describe('catalog', () => {
  it('ships the dataset with media URLs', async () => {
    const bench = await getExercise(ws, 'ed-0025')
    expect(bench).toMatchObject({
      name: 'Barbell Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      custom: false,
    })
    expect(bench.gif).toMatch(/^https:\/\/raw\.githubusercontent\.com\/hasaneyldrm\/exercises-dataset\/main\//)
  })

  it('finds by words, best match first, and pages', async () => {
    const found = await searchExercises(ws, { q: 'bench press', limit: 5 })
    expect(found.items[0]?.name).toMatch(/Bench Press/)
    expect(found.items).toHaveLength(5)
    expect(found.total).toBeGreaterThan(5)
    expect(found.muscles).toContain('Upper Legs')
  })

  it('filters by muscle and by the equipment the user owns', async () => {
    const chest = await searchExercises(ws, { muscle: 'chest', owned: ownedEquipment(['bodyweight']), limit: 200 })
    expect(chest.items.length).toBeGreaterThan(0)
    expect(chest.items.every((e) => e.muscleGroup === 'Chest' && e.equipment === 'Body Weight')).toBe(true)
  })

  it('rejects unknown ids and names the closest', async () => {
    await expect(assertKnownExercises(ws, [{ exercise: 'bench', name: 'Barbell Bench Press' }])).rejects.toThrow(
      /closest: ed-0025 Barbell Bench Press/,
    )
    await expect(assertKnownExercises(ws, [{ exercise: 'ed-0025', name: 'x' }])).resolves.toBeUndefined()
  })
})

describe('custom exercises', () => {
  it('is a page in Training/Exercises, found first', async () => {
    const made = await createCustomExercise(ws, {
      name: 'Landmine Press',
      muscleGroup: 'Shoulders',
      equipment: 'Barbell',
      instructions: ['Hold the bar end', 'Press up'],
    })
    expect(made).toMatchObject({
      id: 'custom:landmine-press',
      custom: true,
      instructions: ['Hold the bar end', 'Press up'],
    })
    const src = await readFile(path.join(ws, 'Training/Exercises/landmine-press.md'), 'utf8')
    expect(src).toContain('muscleGroup: Shoulders')
    expect((await searchExercises(ws, { q: 'landmine' })).items[0]?.id).toBe('custom:landmine-press')
    await expect(
      createCustomExercise(ws, { name: 'Landmine press', muscleGroup: 'x', equipment: 'y' }),
    ).rejects.toThrow(/already/)
  })
})
