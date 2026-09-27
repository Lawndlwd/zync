import type { CalendarItem, Person } from '../api'
import { addDays, pad2, startOfDay, startOfWeek } from '../workspaceData'

// Calendar times are local wall-clock strings, exactly as stored in the files:
// "2026-09-28" (a day) or "2026-09-28T14:00" (a moment).

export type View = 'month' | 'week' | 'day' | 'timeline'

export const SNAP = 15
export const DEFAULT_MINUTES = 60
export const TIMELINE_DAYS = 28

export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
export const stamp = (d: Date) => `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
export const toDate = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s.slice(0, 16))
export const dayOf = (s: string) => s.slice(0, 10)
/** Minutes since midnight of a "…THH:MM" stamp. */
export const minuteOf = (s: string) => (s.length > 10 ? Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) : 0)
export const atMinute = (day: string, minute: number) => stamp(new Date(toDate(day).getTime() + minute * 60_000))
export const addMinutes = (s: string, m: number) => stamp(new Date(toDate(s).getTime() + m * 60_000))
export const minutesBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 60_000)
export const shiftDays = (s: string, n: number) =>
  s.length === 10 ? ymd(addDays(toDate(s), n)) : stamp(addDays(toDate(s), n))
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

const MONTHS = [
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
const MO = MONTHS.map((m) => m.slice(0, 3))

export function rangeLabel(view: View, date: Date, days: Date[]): string {
  if (view === 'month') return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const a = days[0]
  const b = days[days.length - 1]
  if (view === 'day') return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MO[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MO[a.getMonth()]} – ${b.getDate()} ${MO[b.getMonth()]} ${b.getFullYear()}`
}

export const AI_COLOR = '#8b5cf6'

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
): (T & { col: number; cols: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: (T & { col: number; cols: number })[] = []
  let cluster: (T & { col: number; cols: number })[] = []
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
export function lanes<T extends { a: number; b: number }>(bars: T[]): (T & { lane: number })[] {
  const ends: number[] = []
  return [...bars]
    .sort((x, y) => x.a - y.a || y.b - x.b)
    .map((bar) => {
      let lane = ends.findIndex((e) => e < bar.a)
      if (lane < 0) lane = ends.length
      ends[lane] = bar.b
      return { ...bar, lane }
    })
}

/** What every calendar view gets from CalendarView. */
export interface ViewProps {
  items: CalendarItem[]
  people: Person[]
  days: Date[]
  /** `ref` of the item open in the side panel. */
  selectedId?: string
  onOpen: (item: CalendarItem) => void
  onChange: (item: CalendarItem, start: string, end: string) => void
  onCreate: (start: string, end: string) => void
  onDay: (d: Date) => void
}

/**
 * Pointer drag with a small dead zone, tracked on the window so it keeps working when the pointer
 * leaves the element. `end(false)` means it was a click.
 */
export function startDrag(
  e: { clientX: number; clientY: number; button: number; preventDefault: () => void },
  on: { move: (x: number, y: number) => void; end: (moved: boolean) => void },
) {
  if (e.button !== 0) return
  e.preventDefault()
  const x0 = e.clientX
  const y0 = e.clientY
  let moved = false
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return
    moved = true
    on.move(ev.clientX, ev.clientY)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.body.classList.remove('cal-dragging')
    on.end(moved)
  }
  document.body.classList.add('cal-dragging')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** The `[data-day]` element under x (and y, when given) inside `root`. */
export function dayAt(root: HTMLElement | null, x: number, y?: number): { day: string; rect: DOMRect } | null {
  if (!root) return null
  for (const el of root.querySelectorAll<HTMLElement>('[data-day]')) {
    const r = el.getBoundingClientRect()
    if (x >= r.left && x < r.right && (y === undefined || (y >= r.top && y < r.bottom)))
      return { day: el.dataset.day as string, rect: r }
  }
  return null
}

/** "14:00" */
export const hm = (s: string) => s.slice(11, 16)
