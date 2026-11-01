import { addDays, localStamp, mondayOf } from '../helpers/dates.js'
import { readProfile } from './profile.js'
import { listRoutines, plannedOn } from './routines.js'
import { localDay, streakOf, volumeOf } from './stats.js'
import type { Routine, Workout } from './types.js'
import { finished, readWorkouts, withPrevious } from './workouts.js'

export type TrainingWeek = {
  /** Monday to Sunday. */
  days: Array<{ date: string; trained: boolean }>
  volumeKg: number
  /** Finished workouts this week. */
  done: number
  /** Sessions the routines plan per week. */
  planned: number
}

export type TrainingToday = {
  profile: boolean
  planned: Routine | null
  active: Workout | null
  week: TrainingWeek
  streak: number
}

/** The Training home: today's routine, the workout in progress, this week, the streak. */
export async function trainingToday(wsPath: string, today = localStamp().slice(0, 10)): Promise<TrainingToday> {
  const [profile, routines, all] = await Promise.all([readProfile(wsPath), listRoutines(wsPath), readWorkouts(wsPath)])
  const done = finished(all).map((w) => ({ w, day: localDay(w.startedAt) }))
  const trained = new Set(done.map((x) => x.day))
  const monday = mondayOf(today)
  const sunday = addDays(monday, 6)
  const thisWeek = done.filter((x) => x.day >= monday && x.day <= sunday)
  const active = all.find((w) => w.endedAt === undefined)
  return {
    profile: profile !== null,
    planned: plannedOn(routines, today),
    active: active ? withPrevious(all, active) : null,
    week: {
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i)
        return { date, trained: trained.has(date) }
      }),
      volumeKg: Math.round(thisWeek.reduce((s, x) => s + volumeOf(x.w.exercises), 0)),
      done: thisWeek.length,
      planned: routines.reduce((n, r) => n + r.days.length, 0),
    },
    streak: streakOf(trained, today),
  }
}
