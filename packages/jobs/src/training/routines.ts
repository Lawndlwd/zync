import { rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { notFound } from '../errors.js'
import { asUtc } from '../helpers/dates.js'
import { freeFileName, listMdFiles } from '../helpers/files.js'
import { safeName } from '../helpers/names.js'
import { assertKnownExercises } from './exercises.js'
import { pageIn, routinesDir } from './paths.js'
import { readRecord, type RecordPage, writeRecord } from './record-file.js'
import {
  type Day,
  DAYS,
  type Routine,
  RoutineExerciseSchema,
  RoutineFileSchema,
  type RoutineInput,
  RoutineInputSchema,
  type RoutinePatch,
  RoutinePatchSchema,
} from './types.js'

/** Lenient: entries that don't validate are skipped, the rest of the routine still shows. */
function parseRoutine(file: string, page: RecordPage): Routine {
  const meta = RoutineFileSchema.parse(page.data)
  return {
    file,
    name: file.replace(/\.md$/, ''),
    days: meta.days,
    ...(meta.folder ? { folder: meta.folder } : {}),
    exercises: meta.exercises.flatMap((e) => {
      const r = RoutineExerciseSchema.safeParse(e)
      return r.success ? [r.data] : []
    }),
    notes: page.body,
  }
}

async function write(dir: string, routine: Routine): Promise<Routine> {
  await writeRecord(
    path.join(dir, routine.file),
    { days: routine.days, folder: routine.folder, exercises: routine.exercises },
    routine.notes,
  )
  return routine
}

const firstDay = (r: Routine) => {
  const i = DAYS.findIndex((d) => r.days.includes(d))
  return i === -1 ? DAYS.length : i
}

/** Every routine, in week order (by its first day), then by name. */
export async function listRoutines(wsPath: string): Promise<Routine[]> {
  const dir = await routinesDir(wsPath)
  const files = await listMdFiles(dir)
  const pages = await Promise.all(files.map(async (f) => ({ f, page: await readRecord(path.join(dir, f)) })))
  return pages
    .flatMap(({ f, page }) => (page ? [parseRoutine(f, page)] : []))
    .toSorted((a, b) => firstDay(a) - firstDay(b) || a.name.localeCompare(b.name))
}

export async function readRoutine(wsPath: string, file: string): Promise<Routine> {
  const page = await readRecord(pageIn(await routinesDir(wsPath), file, 'routine'))
  if (!page) throw notFound(`Unknown routine "${file}"`)
  return parseRoutine(file, page)
}

export async function createRoutine(wsPath: string, raw: RoutineInput): Promise<Routine> {
  const input = RoutineInputSchema.parse(raw)
  const exercises = input.exercises ?? []
  await assertKnownExercises(wsPath, exercises)
  const dir = await routinesDir(wsPath)
  const file = await freeFileName(dir, input.name)
  return write(dir, {
    file,
    name: file.replace(/\.md$/, ''),
    days: input.days ?? [],
    ...(input.folder ? { folder: input.folder } : {}),
    exercises,
    notes: input.notes?.trim() ?? '',
  })
}

/** Create a routine, or replace the one with the same name (what the AI does when refining a plan). */
export async function saveRoutine(wsPath: string, raw: RoutineInput): Promise<Routine> {
  const input = RoutineInputSchema.parse(raw)
  const file = `${safeName(input.name)}.md`
  const current = await readRoutine(wsPath, file).catch(() => null)
  if (!current) return createRoutine(wsPath, input)
  return updateRoutine(wsPath, file, {
    days: input.days ?? current.days,
    folder: input.folder ?? null,
    exercises: input.exercises ?? current.exercises,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  })
}

/** Change a routine; a new name renames its file. */
export async function updateRoutine(wsPath: string, file: string, raw: RoutinePatch): Promise<Routine> {
  const patch = RoutinePatchSchema.parse(raw)
  const current = await readRoutine(wsPath, file)
  if (patch.exercises) await assertKnownExercises(wsPath, patch.exercises)
  const dir = await routinesDir(wsPath)
  const next: Routine = { ...current }
  if (patch.days) next.days = patch.days
  if (patch.folder === null) delete next.folder
  else if (patch.folder !== undefined) next.folder = patch.folder
  if (patch.exercises) next.exercises = patch.exercises
  if (patch.notes !== undefined) next.notes = patch.notes.trim()
  if (patch.name !== undefined && safeName(patch.name) !== current.name) {
    next.file = await freeFileName(dir, patch.name, file)
    next.name = next.file.replace(/\.md$/, '')
    await rename(path.join(dir, file), path.join(dir, next.file))
  }
  return write(dir, next)
}

export async function deleteRoutine(wsPath: string, file: string): Promise<void> {
  await readRoutine(wsPath, file)
  await rm(pageIn(await routinesDir(wsPath), file, 'routine'))
}

/** "2026-09-29" → "Tue". */
export const dayOf = (date: string): Day => DAYS[(asUtc(date).getUTCDay() + 6) % 7] ?? 'Mon'

/** The routine planned on a day (its weekday is in `days`), if any. */
export const plannedOn = (routines: Routine[], date: string) =>
  routines.find((r) => r.days.includes(dayOf(date))) ?? null
