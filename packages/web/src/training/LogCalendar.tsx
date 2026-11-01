import { Link } from 'react-router'

import { WEEKDAYS_MONDAY_FIRST } from '../helpers/dates'
import { monthCells } from '../helpers/training'
import type { WorkoutSummary } from '../types/training'

/** A month, Monday first: the days with a workout lead to it. */
export function LogCalendar({
  month,
  workouts,
  openFile,
  linkTo,
}: {
  month: string
  workouts: WorkoutSummary[]
  openFile: string
  linkTo: (file: string) => string
}) {
  const byDate = new Map<string, WorkoutSummary[]>()
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])

  return (
    <div className="tr-cal" role="grid" aria-label="Workouts this month">
      {WEEKDAYS_MONDAY_FIRST.map((d) => (
        <span key={d} className="mono-s muted tr-cal-h" role="columnheader">
          {d.slice(0, 2)}
        </span>
      ))}
      {monthCells(month).map((c) => {
        const day = byDate.get(c.date) ?? []
        const first = day[0]
        const n = Number(c.date.slice(8, 10))
        const cls = `tr-cal-d${c.inMonth ? '' : ' out'}${first ? ' done' : ''}${day.some((w) => w.file === openFile) ? ' sel' : ''}`
        return first ? (
          <Link
            key={c.date}
            role="gridcell"
            to={linkTo(first.file)}
            className={cls}
            title={day.map((w) => w.name).join(' · ')}
          >
            {n}
          </Link>
        ) : (
          <span key={c.date} role="gridcell" className={cls}>
            {n}
          </span>
        )
      })}
    </div>
  )
}
