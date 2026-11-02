import { localStamp } from '../helpers/dates.js'
import { durationMin, volumeOf } from '../training/stats.js'
import { readWorkouts } from '../training/workouts.js'
import type { Identity, WorkoutDone } from './types.js'

/** Whether finished workouts vote for the identity. */
export const votesOnWorkouts = (identity: Identity) => identity.signals.some((s) => 'workout' in s)

/** Finished workouts (Training/Log) that started on a local day in [from, to), oldest first. */
export async function workoutsDone(wsPath: string, from: string, to: string): Promise<WorkoutDone[]> {
  const all = await readWorkouts(wsPath).catch(() => [])
  return all.flatMap((w) => {
    if (w.endedAt === undefined) return []
    const start = localStamp(new Date(w.startedAt))
    const date = start.slice(0, 10)
    if (date < from || date >= to) return []
    return [
      {
        date,
        start: start.slice(11, 16),
        end: localStamp(new Date(w.endedAt)).slice(11, 16),
        name: w.name,
        minutes: durationMin(w),
        volumeKg: volumeOf(w.exercises),
      },
    ]
  })
}
