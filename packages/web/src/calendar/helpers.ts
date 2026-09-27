import { addDays, MONTHS, MONTHS_SHORT, pad2, startOfDay, startOfWeek, ymd } from '../helpers/dates'
import { clamp } from '../helpers/math'
import type { CalendarFilter, CalendarItem, Selection, View } from '../types/calendar'
import type { Person } from '../types/people'

// Calendar times are local wall-clock strings, exactly as stored in the files:
// "2026-09-28" (a day) or "2026-09-28T14:00" (a moment).

export const SNAP = 15
export const DEFAULT_MINUTES = 60
const TIMELINE_DAYS = 28

const toStamp = (d: Date) => `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
export const toDate = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s.slice(0, 16))
export const dayOf = (s: string) => s.slice(0, 10)
/** Minutes since midnight of a "…THH:MM" stamp. */
export const minuteOf = (s: string) => (s.length > 10 ? Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) : 0)
export const atMinute = (day: string, minute: number) => toStamp(new Date(toDate(day).getTime() + minute * 60_000))
export const addMinutes = (s: string, m: number) => toStamp(new Date(toDate(s).getTime() + m * 60_000))
export const minutesBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 60_000)
export const shiftDays = (s: string, n: number) =>
  s.length === 10 ? ymd(addDays(toDate(s), n)) : toStamp(addDays(toDate(s), n))
export const daysBetween = (a: string, b: string) =>
  Math.round((toDate(dayOf(b)).getTime() - toDate(dayOf(a)).getTime()) / 86_400_000)

/** The days an item covers (all-day: start…end inclusive; timed: the days it touches). */
export function daysOf(item: CalendarItem): string[] {
  const last = item.allDay
    ? item.end
    : item.end.endsWith('T00:00') && item.end > item.start
      ? shiftDays(dayOf(item.end), -1)
      : dayOf(item.end)
  const out: string[] = []
  for (let d = dayOf(item.start); d <= last && out.length < 366; d = shiftDays(d, 1)) out.push(d)
  return out
}

/** First day shown and the day after the last, for a view anchored on `date`. */
export function rangeOf(view: View, date: Date): { from: Date; to: Date; days: Date[] } {
  let from: Date
  let n: number
  if (view === 'day') {
    from = startOfDay(date)
    n = 1
  } else if (view === 'week') {
    from = startOfWeek(date)
    n = 7
  } else if (view === 'month') {
    from = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1))
    n = 42
  } else {
    from = startOfWeek(date)
    n = TIMELINE_DAYS
  }
  const days = Array.from({ length: n }, (_, i) => addDays(from, i))
  return { from, to: addDays(from, n), days }
}

/** Previous / next page for the arrows. */
export function stepDate(view: View, date: Date, dir: -1 | 1): Date {
  if (view === 'day') return addDays(date, dir)
  if (view === 'week') return addDays(date, 7 * dir)
  if (view === 'timeline') return addDays(date, 14 * dir)
  return new Date(date.getFullYear(), date.getMonth() + dir, 1)
}

export function rangeLabel(view: View, date: Date, days: Date[]): string {
  if (view === 'month') return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const a = days[0] ?? date
  const b = days.at(-1) ?? date
  if (view === 'day') return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
}

const AI_COLOR = '#8b5cf6'

/** The color an item wears: AI purple for the AI's work, else its person's color. */
export function colorOf(item: CalendarItem, people: Person[]): string | undefined {
  if (item.kind === 'job' || item.kind === 'card-ai' || item.kind === 'run') return AI_COLOR
  const who = item.kind === 'event' ? item.people?.[0] : item.assignee
  return who ? people.find((p) => p.id === who)?.color : undefined
}

export const isDone = (item: CalendarItem) => item.kind === 'card' && item.status === 'done'

/** Can the end be dragged? Events and human cards have a length; AI runs and jobs don't. */
export const resizable = (item: CalendarItem) => item.editable && (item.kind === 'event' || item.kind === 'card')

/**
 * Side-by-side columns for overlapping timed blocks of one day: each block gets its column and
 * how many columns its cluster of overlaps needs.
 */
export function layoutDay<T extends { start: number; end: number }>(
  blocks: T[],
): Array<T & { col: number; cols: number }> {
  const sorted = [...blocks].toSorted((a, b) => a.start - b.start || b.end - a.end)
  const out: Array<T & { col: number; cols: number }> = []
  let cluster: Array<T & { col: number; cols: number }> = []
  let clusterEnd = -1
  const close = () => {
    const cols = Math.max(1, ...cluster.map((b) => b.col + 1))
    for (const b of cluster) b.cols = cols
    cluster = []
  }
  for (const b of sorted) {
    if (b.start >= clusterEnd) {
      close()
      clusterEnd = -1
    }
    const taken = new Set(cluster.filter((c) => c.end > b.start).map((c) => c.col))
    let col = 0
    while (taken.has(col)) col++
    const placed = { ...b, col, cols: 1 }
    cluster.push(placed)
    out.push(placed)
    clusterEnd = Math.max(clusterEnd, b.end)
  }
  close()
  return out
}

/** Stack bars into lanes so none overlap (timeline rows, spanning all-day bars). */
export function lanes<T extends { a: number; b: number }>(bars: T[]): Array<T & { lane: number }> {
  const ends: number[] = []
  return [...bars]
    .toSorted((x, y) => x.a - y.a || y.b - x.b)
    .map((bar) => {
      let lane = ends.findIndex((e) => e < bar.a)
      if (lane < 0) lane = ends.length
      ends[lane] = bar.b
      return Object.assign(bar, { lane })
    })
}

/** "14:00" */
export const hm = (s: string) => s.slice(11, 16)

export const CALENDAR_DIR = 'Calendar'

export const HOUR = 48

export const PX_PER_MIN = HOUR / 60

export const snap = (m: number) => Math.round(m / SNAP) * SNAP

export const clampMin = (m: number) => clamp(m, 0, 24 * 60)

export const filterOf = (i: CalendarItem): CalendarFilter =>
  i.kind === 'event' ? 'events' : i.kind === 'card' ? 'cards' : i.kind === 'run' ? 'runs' : 'ai'

export function selectionKey(s: Selection): string {
  if (s.type === 'card') return `card:${s.board}/${s.file}`
  if (s.type === 'event') return `event:${s.file}`
  return `new:${s.start}`
}

export function selectionId(s: Selection | null): string | undefined {
  if (!s) return undefined
  if (s.type === 'card') return `${s.board}/${s.file}`
  if (s.type === 'event') return `Calendar/${s.file}`
  return undefined
}
