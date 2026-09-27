// Dates as the UI shows them: fixed English labels (like the design, whatever the browser locale).

export const pad2 = (n: number) => String(n).padStart(2, '0')

/** "2026-09-28" in local time. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))
/** Sunday first, like `Date.getDay()`. */
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Monday first, for week grids. */
export const WEEKDAYS_MONDAY_FIRST = [...WEEKDAYS_SHORT.slice(1), 'Sun']

/** A card's `due` as a moment: a date-only due means the end of that day. */
export function dueDate(due: string): Date {
  return new Date(due.length === 10 ? `${due}T23:59` : due)
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Monday 00:00 of d's week. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()

export const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** "Thu 24 Sep" */
export const dayLabel = (d: Date) => `${WEEKDAYS_SHORT[d.getDay()]} ${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()]}`

/** "Sat 26 Sep 2026 · 11:42" */
export const dateTimeLabel = (d: Date) => `${dayLabel(d)} ${d.getFullYear()} · ${hhmm(d)}`

export const weekdayShort = (d: Date) => WEEKDAYS_SHORT[d.getDay()]

/** "in 2h 48m" */
export function until(d: Date, now = new Date()): string {
  const mins = Math.max(0, Math.round((d.getTime() - now.getTime()) / 60_000))
  if (mins < 60) return `in ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `in ${h}h ${mins % 60}m`
  return `in ${Math.round(h / 24)}d`
}

/** "Now", "12 min ago", "1 h ago", "Yesterday", "Thu 24 Sep" */
export function ago(d: Date, now = new Date()): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000)
  if (mins < 1) return 'Now'
  if (mins < 60) return `${mins} min ago`
  if (sameDay(d, now)) return `${Math.floor(mins / 60)} h ago`
  if (sameDay(d, addDays(now, -1))) return 'Yesterday'
  return dayLabel(d)
}

/** "Today 09:00", "Tomorrow 09:00", else "Thu 24 Sep 09:00". */
export const relativeDayTime = (d: Date, now = new Date()) =>
  sameDay(d, now)
    ? `Today ${hhmm(d)}`
    : sameDay(d, addDays(now, 1))
      ? `Tomorrow ${hhmm(d)}`
      : `${dayLabel(d)} ${hhmm(d)}`

/** "09:00" today, else "Thu 09:00"; an unparseable value as-is. */
export function shortDayTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return sameDay(d, now) ? hhmm(d) : `${dayLabel(d).slice(0, 3)} ${hhmm(d)}`
}

export function parseDateValue(v: string | undefined): { date: Date | null; time: string } {
  if (!v) return { date: null, time: '09:00' }
  const [d, t] = v.split('T')
  const date = new Date(`${d}T00:00`)
  return { date: Number.isNaN(date.getTime()) ? null : date, time: t?.slice(0, 5) || '09:00' }
}

export const sameYmd = (a: Date | null, b: Date) => !!a && ymd(a) === ymd(b)

export function formatDateValue(v: string | undefined, withYear = true): string {
  const { date, time } = parseDateValue(v)
  if (!date) return ''
  const day = `${dayLabel(date)}${withYear ? ` ${date.getFullYear()}` : ''}`
  return v?.includes('T') ? `${day} · ${time}` : day
}
