import { addDays, localStamp } from '../helpers/dates.js'
import type { Best, TargetSet, WorkoutExercise, WorkoutRecord, WorkoutSet } from './types.js'

// Pure numbers over workouts: volume, estimated one-rep max, bests, duration, streak.

const round1 = (n: number) => Math.round(n * 10) / 10

/** The sets that count: done, not warm-ups. */
export const workingSets = (sets: WorkoutSet[]) => sets.filter((s) => s.done && s.warmup !== true)

/** Just the weight and reps of a set (absent stays absent). */
export function targetOf(s: { kg?: number | undefined; reps?: number | undefined }): TargetSet {
  const t: TargetSet = {}
  if (s.kg !== undefined) t.kg = s.kg
  if (s.reps !== undefined) t.reps = s.reps
  return t
}

/** Σ kg × reps over the sets that count. */
export const volumeOf = (exercises: WorkoutExercise[]) =>
  round1(
    exercises.reduce((sum, e) => sum + workingSets(e.sets).reduce((s, x) => s + (x.kg ?? 0) * (x.reps ?? 0), 0), 0),
  )

/** Estimated one-rep max (Epley): kg × (1 + reps / 30); a single is the weight itself. */
export function e1rm(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0
  return reps === 1 ? kg : round1(kg * (1 + reps / 30))
}

/** The set with the highest e1RM (weighted sets only); null when none. */
export function bestOf(sets: readonly TargetSet[]): Best | null {
  let best: Best | null = null
  for (const s of sets) {
    const kg = s.kg ?? 0
    const reps = s.reps ?? 0
    const est = e1rm(kg, reps)
    if (est > 0 && (!best || est > best.e1rm)) best = { kg, reps, e1rm: est }
  }
  return best
}

/** The local day a moment falls on (the scheduler's timezone). */
export const localDay = (iso: string) => localStamp(new Date(iso)).slice(0, 10)

/** Whole minutes from start to end; 0 while in progress. */
export const durationMin = (w: Pick<WorkoutRecord, 'startedAt' | 'endedAt'>) =>
  w.endedAt ? Math.max(0, Math.round((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 60_000)) : 0

/** Consecutive days with a finished workout, ending today, or yesterday when today has none yet. */
export function streakOf(trainedDays: ReadonlySet<string>, today: string): number {
  let day = trainedDays.has(today) ? today : addDays(today, -1)
  let n = 0
  while (trainedDays.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/** "6.2 t" for 6,240 kg, "850 kg" under a tonne. */
export const tonnage = (kg: number) => (kg >= 1000 ? `${round1(kg / 1000)} t` : `${Math.round(kg)} kg`)
