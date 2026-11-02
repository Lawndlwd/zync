import { getExercise } from './exercises.js'
import { bestOf, localDay, workingSets } from './stats.js'
import type { Best, Exercise, WorkoutSet } from './types.js'
import { finished, readWorkouts } from './workouts.js'

export type ExerciseHistoryEntry = { workout: string; date: string; sets: WorkoutSet[] }
export type ExerciseDetail = { exercise: Exercise; history: ExerciseHistoryEntry[]; best: Best | null }

/** An exercise with every finished workout that trained it (newest first) and its all-time best set. */
export async function exerciseDetail(wsPath: string, id: string): Promise<ExerciseDetail> {
  const [exercise, all] = await Promise.all([getExercise(wsPath, id), readWorkouts(wsPath)])
  const history = finished(all)
    .toReversed()
    .flatMap((w): ExerciseHistoryEntry[] => {
      const sets = w.exercises.filter((e) => e.exercise === id).flatMap((e) => workingSets(e.sets))
      return sets.length > 0 ? [{ workout: w.file, date: localDay(w.startedAt), sets }] : []
    })
  return { exercise, history, best: bestOf(history.flatMap((h) => h.sets)) }
}
