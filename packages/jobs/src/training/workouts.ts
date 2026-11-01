import { rm } from 'node:fs/promises'
import path from 'node:path'

import { conflict, notFound } from '../errors.js'
import { exists, listMdFiles } from '../helpers/files.js'
import { slugify } from '../helpers/names.js'
import { allExercises } from './exercises.js'
import { logDir, pageIn } from './paths.js'
import { suggestSets } from './progression.js'
import { readRecord, type RecordPage, writeRecord } from './record-file.js'
import { readRoutine } from './routines.js'
import { durationMin, localDay, targetOf, volumeOf, workingSets } from './stats.js'
import {
  type PreviousSets,
  type TargetSet,
  type Workout,
  type WorkoutExercise,
  WorkoutExerciseSchema,
  WorkoutFileSchema,
  type WorkoutRecord,
  WorkoutStartSchema,
  type WorkoutSummary,
  type WorkoutUpdate,
  WorkoutUpdateSchema,
} from './types.js'

export const DEFAULT_WORKOUT_NAME = 'Workout'

/** The workout's title: its routine's name, or "Workout". */
export const workoutName = (routine: string | undefined) =>
  routine ? routine.replace(/\.md$/, '') : DEFAULT_WORKOUT_NAME

/** Lenient: an unreadable start time hides the file; bad exercise entries are skipped. */
function parseWorkout(file: string, page: RecordPage): WorkoutRecord | null {
  const r = WorkoutFileSchema.safeParse(page.data)
  if (!r.success) return null
  const { routine, startedAt, endedAt } = r.data
  return {
    file,
    name: workoutName(routine),
    ...(routine ? { routine } : {}),
    startedAt,
    ...(endedAt ? { endedAt } : {}),
    exercises: r.data.exercises.flatMap((e) => {
      const x = WorkoutExerciseSchema.safeParse(e)
      return x.success ? [x.data] : []
    }),
    notes: page.body,
  }
}

export async function writeWorkout(wsPath: string, w: WorkoutRecord): Promise<WorkoutRecord> {
  await writeRecord(
    pageIn(await logDir(wsPath), w.file, 'workout'),
    { routine: w.routine, startedAt: w.startedAt, endedAt: w.endedAt, exercises: w.exercises },
    w.notes,
  )
  return w
}

/** Every workout, oldest first. */
export async function readWorkouts(wsPath: string): Promise<WorkoutRecord[]> {
  const dir = await logDir(wsPath)
  const files = await listMdFiles(dir)
  const pages = await Promise.all(files.map(async (f) => ({ f, page: await readRecord(path.join(dir, f)) })))
  return pages
    .flatMap(({ f, page }) => {
      const w = page ? parseWorkout(f, page) : null
      return w ? [w] : []
    })
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt) || a.file.localeCompare(b.file))
}

/** Finished workouts, oldest first. */
export const finished = (all: WorkoutRecord[]) => all.filter((w) => w.endedAt !== undefined)

export async function readWorkoutRecord(wsPath: string, file: string): Promise<WorkoutRecord> {
  const page = await readRecord(pageIn(await logDir(wsPath), file, 'workout'))
  const w = page ? parseWorkout(file, page) : null
  if (!w) throw notFound(`Unknown workout "${file}"`)
  return w
}

/** The sets that counted for `exercise` in the last finished workout (before `before`) that has any. */
export function lastSets(all: WorkoutRecord[], exercise: string, before: string, skip?: string): TargetSet[] {
  for (const w of finished(all).toReversed()) {
    if (w.file === skip || w.startedAt >= before) continue
    const sets = w.exercises.filter((e) => e.exercise === exercise).flatMap((e) => workingSets(e.sets))
    if (sets.length > 0) return sets.map(targetOf)
  }
  return []
}

/** What each of the workout's exercises was the time before. */
export function previousOf(all: WorkoutRecord[], w: WorkoutRecord): PreviousSets {
  const out: PreviousSets = {}
  for (const e of w.exercises) {
    if (e.exercise in out) continue
    const sets = lastSets(all, e.exercise, w.startedAt, w.file)
    if (sets.length > 0) out[e.exercise] = sets
  }
  return out
}

export const withPrevious = (all: WorkoutRecord[], w: WorkoutRecord): Workout => ({
  ...w,
  previous: previousOf(all, w),
})

export async function readWorkout(wsPath: string, file: string): Promise<Workout> {
  const w = await readWorkoutRecord(wsPath, file)
  return withPrevious(await readWorkouts(wsPath), w)
}

/** The workout in progress, if any. */
export async function activeWorkout(wsPath: string): Promise<Workout | null> {
  const all = await readWorkouts(wsPath)
  const active = all.find((w) => w.endedAt === undefined)
  return active ? withPrevious(all, active) : null
}

/** "2026-09-29-push-day.md", or "…-2.md" when taken. */
export async function freeWorkoutFile(wsPath: string, day: string, name: string): Promise<string> {
  const dir = await logDir(wsPath)
  const base = `${day}-${slugify(name, 40, 'workout')}`
  let file = `${base}.md`
  for (let i = 2; await exists(path.join(dir, file)); i++) file = `${base}-${i}.md`
  return file
}

/**
 * Start a workout, empty or from a routine: its exercises with today's targets (the progression
 * suggestion over last time). Only one workout runs at a time (409).
 */
export async function startWorkout(
  wsPath: string,
  raw: { routine?: string | undefined } = {},
  now = new Date(),
): Promise<Workout> {
  const input = WorkoutStartSchema.parse(raw)
  const all = await readWorkouts(wsPath)
  const running = all.find((w) => w.endedAt === undefined)
  if (running) throw conflict(`A workout is already in progress: ${running.file}`)
  const routine = input.routine ? await readRoutine(wsPath, input.routine) : null
  const startedAt = now.toISOString()
  const record: WorkoutRecord = {
    file: await freeWorkoutFile(wsPath, localDay(startedAt), workoutName(routine?.file)),
    name: workoutName(routine?.file),
    ...(routine ? { routine: routine.file } : {}),
    startedAt,
    exercises: (routine?.exercises ?? []).map((re) => {
      const e: WorkoutExercise = {
        exercise: re.exercise,
        name: re.name,
        sets: suggestSets(re, lastSets(all, re.exercise, startedAt)).map((s) =>
          Object.assign(targetOf(s), { done: false }),
        ),
      }
      if (re.rest !== undefined) e.rest = re.rest
      return e
    }),
    notes: '',
  }
  await writeWorkout(wsPath, record)
  return withPrevious(all, record)
}

/** Replace a workout's exercises (and notes): the live logger saves the whole thing. */
export async function updateWorkout(wsPath: string, file: string, raw: WorkoutUpdate): Promise<Workout> {
  const update = WorkoutUpdateSchema.parse(raw)
  const current = await readWorkoutRecord(wsPath, file)
  const next: WorkoutRecord = {
    ...current,
    exercises: update.exercises,
    notes: update.notes?.trim() ?? current.notes,
  }
  await writeWorkout(wsPath, next)
  return withPrevious(await readWorkouts(wsPath), next)
}

export async function deleteWorkout(wsPath: string, file: string): Promise<void> {
  await readWorkoutRecord(wsPath, file)
  await rm(pageIn(await logDir(wsPath), file, 'workout'))
}

/** Exercise id → muscle group, for the summaries. */
export async function muscleIndex(wsPath: string): Promise<Map<string, string>> {
  return new Map((await allExercises(wsPath)).map((e) => [e.id, e.muscleGroup]))
}

export function summarize(w: WorkoutRecord, muscles: Map<string, string>): WorkoutSummary {
  const done = w.exercises.flatMap((e) => workingSets(e.sets))
  return {
    file: w.file,
    name: w.name,
    date: localDay(w.startedAt),
    durationMin: durationMin(w),
    exercises: w.exercises.length,
    sets: done.length,
    volumeKg: volumeOf(w.exercises),
    muscles: [...new Set(w.exercises.flatMap((e) => muscles.get(e.exercise) ?? []))],
    active: w.endedAt === undefined,
  }
}

/** The workouts of a month ("YYYY-MM"; all when absent), newest first. */
export async function listWorkouts(wsPath: string, month?: string): Promise<WorkoutSummary[]> {
  const [all, muscles] = await Promise.all([readWorkouts(wsPath), muscleIndex(wsPath)])
  return all
    .filter((w) => month === undefined || localDay(w.startedAt).startsWith(`${month}-`))
    .toReversed()
    .map((w) => summarize(w, muscles))
}
