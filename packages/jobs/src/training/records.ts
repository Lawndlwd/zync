import { bestOf, workingSets } from './stats.js'
import type { Best, PersonalRecord, WorkoutRecord } from './types.js'
import { finished } from './workouts.js'

/** The best set of an exercise in one workout (sets that count only). */
export const bestIn = (w: WorkoutRecord, exercise: string) =>
  bestOf(w.exercises.filter((e) => e.exercise === exercise).flatMap((e) => workingSets(e.sets)))

/**
 * The personal records a workout set: per exercise, a best e1RM above every finished workout that
 * started before it (the first time an exercise is done counts, without `previousE1rm`).
 */
export function recordsOf(all: WorkoutRecord[], w: WorkoutRecord): PersonalRecord[] {
  const before = finished(all).filter((x) => x.file !== w.file && x.startedAt < w.startedAt)
  const out: PersonalRecord[] = []
  const seen = new Set<string>()
  for (const e of w.exercises) {
    if (seen.has(e.exercise)) continue
    seen.add(e.exercise)
    const best = bestIn(w, e.exercise)
    if (!best) continue
    const previous = before.reduce((max, x) => Math.max(max, bestIn(x, e.exercise)?.e1rm ?? 0), 0)
    if (best.e1rm <= previous) continue
    out.push({ exercise: e.exercise, name: e.name, ...best, ...(previous > 0 ? { previousE1rm: previous } : {}) })
  }
  return out
}

/** A best e1RM going up: when, in which workout, and by how much (absent the first time). */
export type RecordEvent = Best & { exercise: string; name: string; startedAt: string; workout: string; delta?: number }

/** Every time an exercise's best e1RM went up, oldest first. */
export function recordHistory(all: WorkoutRecord[]): RecordEvent[] {
  const best = new Map<string, number>()
  const out: RecordEvent[] = []
  for (const w of finished(all)) {
    const seen = new Set<string>()
    for (const e of w.exercises) {
      if (seen.has(e.exercise)) continue
      seen.add(e.exercise)
      const top = bestIn(w, e.exercise)
      const was = best.get(e.exercise)
      if (!top || (was !== undefined && top.e1rm <= was)) continue
      best.set(e.exercise, top.e1rm)
      out.push({
        exercise: e.exercise,
        name: e.name,
        ...top,
        startedAt: w.startedAt,
        workout: w.file,
        ...(was === undefined ? {} : { delta: Math.round((top.e1rm - was) * 10) / 10 }),
      })
    }
  }
  return out
}
