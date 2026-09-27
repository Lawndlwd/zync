import { asUtc, daysApart, mondayOf } from '../helpers/dates.js'
import { type Repeat, type Weekday, WEEKDAYS } from './types.js'

/** Only what differs from the defaults, in a stable key order. */
export function cleanRepeat(r: Repeat): Repeat {
  const out: Repeat = { every: r.every }
  if (r.interval && r.interval > 1) out.interval = r.interval
  if (r.every === 'week' && r.days?.length) out.days = WEEKDAYS.filter((d) => r.days?.includes(d))
  if (r.until) out.until = r.until
  if (r.except?.length) out.except = [...new Set(r.except)].toSorted()
  return out
}

const weekday = (date: string): Weekday => WEEKDAYS[asUtc(date).getUTCDay()] ?? 'sun'
/** Does a recurring event (first day `first`) happen on `date`? */
export function repeatsOn(r: Repeat, first: string, date: string): boolean {
  const n = r.interval ?? 1
  if (date < first || (r.until && date > r.until) || r.except?.includes(date)) return false
  const [y0 = 0, m0 = 0, d0 = 0] = first.split('-').map(Number)
  const [y = 0, m = 0, d = 0] = date.split('-').map(Number)
  switch (r.every) {
    case 'day':
      return daysApart(first, date) % n === 0
    case 'week': {
      const days = r.days?.length ? r.days : [weekday(first)]
      return days.includes(weekday(date)) && (daysApart(mondayOf(first), mondayOf(date)) / 7) % n === 0
    }
    case 'month':
      return d === d0 && ((y - y0) * 12 + (m - m0)) % n === 0
    case 'year':
      return d === d0 && m === m0 && (y - y0) % n === 0
  }
}
