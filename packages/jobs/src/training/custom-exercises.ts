import path from 'node:path'

import { conflict } from '../errors.js'
import { exists, listMdFiles } from '../helpers/files.js'
import { slugify } from '../helpers/names.js'
import { titleCase } from './catalog.js'
import { exercisesDir } from './paths.js'
import { readRecord, writeRecord } from './record-file.js'
import {
  CustomExerciseFileSchema,
  type CustomExerciseInput,
  CustomExerciseInputSchema,
  type Exercise,
} from './types.js'

export const CUSTOM_PREFIX = 'custom:'
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** "custom:cable-fly" → "cable-fly"; null when the id isn't a valid custom id. */
export function customSlug(id: string): string | null {
  if (!id.startsWith(CUSTOM_PREFIX)) return null
  const slug = id.slice(CUSTOM_PREFIX.length)
  return SLUG.test(slug) ? slug : null
}

/** A step per line; list markers ("- ", "1. ") are dropped. */
const steps = (body: string) =>
  body
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim())
    .filter((l) => l !== '')

function toExercise(slug: string, data: Record<string, unknown>, body: string): Exercise {
  const meta = CustomExerciseFileSchema.parse(data)
  const name =
    typeof data.name === 'string' && data.name.trim() ? data.name.trim() : titleCase(slug.replaceAll('-', ' '))
  return {
    id: `${CUSTOM_PREFIX}${slug}`,
    name,
    muscleGroup: meta.muscleGroup,
    equipment: meta.equipment,
    ...(meta.target ? { target: meta.target } : {}),
    secondary: meta.secondary,
    instructions: steps(body),
    ...(meta.gif ? { gif: meta.gif } : {}),
    custom: true,
  }
}

export async function listCustomExercises(wsPath: string): Promise<Exercise[]> {
  const dir = await exercisesDir(wsPath)
  const files = await listMdFiles(dir)
  const pages = await Promise.all(files.map(async (f) => ({ f, page: await readRecord(path.join(dir, f)) })))
  return pages.flatMap(({ f, page }) => {
    const slug = f.slice(0, -3)
    return page && SLUG.test(slug) ? [toExercise(slug, page.data, page.body)] : []
  })
}

export async function readCustomExercise(wsPath: string, slug: string): Promise<Exercise | null> {
  const page = await readRecord(path.join(await exercisesDir(wsPath), `${slug}.md`))
  return page ? toExercise(slug, page.data, page.body) : null
}

export async function createCustomExercise(wsPath: string, raw: CustomExerciseInput): Promise<Exercise> {
  const input = CustomExerciseInputSchema.parse(raw)
  const slug = slugify(input.name, 60, 'exercise')
  const file = path.join(await exercisesDir(wsPath), `${slug}.md`)
  if (await exists(file)) throw conflict(`There is already a custom exercise "${input.name}"`)
  await writeRecord(
    file,
    {
      name: input.name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      target: input.target,
      secondary: input.secondary && input.secondary.length > 0 ? input.secondary : undefined,
      gif: input.gif,
    },
    (input.instructions ?? []).map((step, i) => `${i + 1}. ${step}`).join('\n'),
  )
  const made = await readCustomExercise(wsPath, slug)
  if (!made) throw new Error(`Could not read back ${file}`)
  return made
}
