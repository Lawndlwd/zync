import { readFileSync } from 'node:fs'

import { z } from 'zod'

import type { Exercise } from './types.js'

// The exercise catalog: hasaneyldrm/exercises-dataset (1,324 exercises), shipped as
// packages/jobs/assets/exercises.json. src/training/ and dist/training/ sit at the same depth, so
// the same relative URL finds it under tsx, vitest, the build and the Docker image.

const CATALOG_URL = new URL('../../assets/exercises.json', import.meta.url)
const MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/'

const DatasetSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    body_part: z.string(),
    equipment: z.string(),
    target: z.string().optional(),
    secondary_muscles: z.array(z.string()).optional(),
    instructions: z.array(z.string()).optional(),
    image: z.string().optional(),
    gif_url: z.string().optional(),
  }),
)

/** "upper legs" → "Upper Legs". */
export const titleCase = (s: string) =>
  s.replaceAll(/(^|[\s(/-])(\p{L})/gu, (_m, sep: string, c: string) => `${sep}${c.toUpperCase()}`)

let cache: Exercise[] | undefined
let byId: Map<string, Exercise> | undefined

/** Every catalog exercise, read once. */
export function catalog(): Exercise[] {
  if (cache) return cache
  const raw: unknown = JSON.parse(readFileSync(CATALOG_URL, 'utf8'))
  cache = DatasetSchema.parse(raw).map((d) => {
    const e: Exercise = {
      id: `ed-${d.id}`,
      name: titleCase(d.name),
      muscleGroup: titleCase(d.body_part),
      equipment: titleCase(d.equipment),
      secondary: d.secondary_muscles ?? [],
      instructions: d.instructions ?? [],
      custom: false,
    }
    if (d.target) e.target = d.target
    if (d.image) e.image = `${MEDIA_BASE}${d.image}`
    if (d.gif_url) e.gif = `${MEDIA_BASE}${d.gif_url}`
    return e
  })
  return cache
}

export function catalogExercise(id: string): Exercise | undefined {
  byId ??= new Map(catalog().map((e) => [e.id, e]))
  return byId.get(id)
}
