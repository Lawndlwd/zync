import { addDays, localStamp, mondayOf } from '../helpers/dates.js'
import { type BodyWeight, readBodyWeights } from './body-weight.js'
import { recordHistory } from './records.js'
import { localDay, volumeOf } from './stats.js'
import type { ProgressRange } from './types.js'
import { finished, readWorkouts } from './workouts.js'

export type VolumeBucket = { label: string; kg: number }
export type ProgressRecord = {
  exercise: string
  name: string
  date: string
  kg: number
  reps: number
  e1rm: number
  delta?: number
}
export type TrainingProgress = { volume: VolumeBucket[]; prs: ProgressRecord[]; body: BodyWeight[] }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1] ?? ''} ${month.slice(0, 4)}`
/** "2026-09-21" → "21 Sep". */
const weekLabel = (monday: string) => `${Number(monday.slice(8, 10))} ${MONTHS[Number(monday.slice(5, 7)) - 1] ?? ''}`

/** "2026-09" → "2026-10". */
function nextMonth(month: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function monthsBack(month: string, n: number): string {
  let y = Number(month.slice(0, 4))
  let m = Number(month.slice(5, 7)) - n
  while (m < 1) {
    m += 12
    y--
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

const MAX_RECORDS = 50

/**
 * The Progress page: volume per week (8w) or per month (6m, all), the personal records set in the
 * range (newest first), and the body weight curve.
 */
export async function trainingProgress(
  wsPath: string,
  range: ProgressRange,
  today = localStamp().slice(0, 10),
): Promise<TrainingProgress> {
  const [all, body] = await Promise.all([readWorkouts(wsPath), readBodyWeights(wsPath)])
  const done = finished(all).map((w) => ({ w, day: localDay(w.startedAt) }))

  let from: string
  const volume: VolumeBucket[] = []
  if (range === '8w') {
    from = addDays(mondayOf(today), -7 * 7)
    for (let monday = from; monday <= today; monday = addDays(monday, 7)) {
      const end = addDays(monday, 7)
      const kg = done.filter((x) => x.day >= monday && x.day < end).reduce((s, x) => s + volumeOf(x.w.exercises), 0)
      volume.push({ label: weekLabel(monday), kg: Math.round(kg) })
    }
  } else {
    const current = today.slice(0, 7)
    const first = range === '6m' ? monthsBack(current, 5) : (done[0]?.day.slice(0, 7) ?? current)
    from = `${first}-01`
    for (let month = first; month <= current; month = nextMonth(month)) {
      const kg = done.filter((x) => x.day.startsWith(month)).reduce((s, x) => s + volumeOf(x.w.exercises), 0)
      volume.push({ label: monthLabel(month), kg: Math.round(kg) })
    }
  }

  const since = range === 'all' ? '' : from
  const prs = recordHistory(all)
    .map((r) => {
      const pr: ProgressRecord = {
        exercise: r.exercise,
        name: r.name,
        date: localDay(r.startedAt),
        kg: r.kg,
        reps: r.reps,
        e1rm: r.e1rm,
      }
      if (r.delta !== undefined) pr.delta = r.delta
      return pr
    })
    .filter((r) => r.date >= since)
    .toReversed()
    .slice(0, MAX_RECORDS)

  return { volume, prs, body: body.filter((b) => b.date >= since) }
}
