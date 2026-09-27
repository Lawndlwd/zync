import { formatDateValue } from '../helpers/dates'
import type { Every, Repeat, Weekday } from '../types/calendar'

export const WEEK: Array<{ id: Weekday; short: string; long: string }> = [
  { id: 'mon', short: 'M', long: 'Monday' },
  { id: 'tue', short: 'T', long: 'Tuesday' },
  { id: 'wed', short: 'W', long: 'Wednesday' },
  { id: 'thu', short: 'T', long: 'Thursday' },
  { id: 'fri', short: 'F', long: 'Friday' },
  { id: 'sat', short: 'S', long: 'Saturday' },
  { id: 'sun', short: 'S', long: 'Sunday' },
]

export const UNIT: Record<Every, string> = { day: 'day', week: 'week', month: 'month', year: 'year' }

const SUNDAY_FIRST: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** The weekday of a "YYYY-MM-DD[THH:MM]" start. */
export const weekdayOf = (start: string): Weekday =>
  SUNDAY_FIRST[new Date(`${start.slice(0, 10)}T12:00`).getDay()] ?? 'sun'

/** "Every Mon, Fri at 05:00 · until 31 Dec" */
export function describeRepeat(r: Repeat, start: string): string {
  const n = r.interval ?? 1
  const every = n > 1 ? `Every ${n} ${UNIT[r.every]}s` : `Every ${UNIT[r.every]}`
  const days =
    r.every === 'week'
      ? ` on ${(r.days?.length ? r.days : [weekdayOf(start)])
          .map((d) => WEEK.find((w) => w.id === d)?.long.slice(0, 3))
          .join(', ')}`
      : r.every === 'month'
        ? ` on day ${Number(start.slice(8, 10))}`
        : ''
  const at = start.length > 10 ? ` at ${start.slice(11, 16)}` : ''
  const until = r.until ? ` · until ${formatDateValue(r.until, false)}` : ''
  const skipped = r.except?.length ? ` · ${r.except.length} skipped` : ''
  return `${every}${days}${at}${until}${skipped}`
}
