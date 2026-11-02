import type {
  Guard,
  Identity,
  Signal,
  Slot,
  Stage,
  StageProgress,
  StripCell,
  TodayRow,
  VoteSource,
  Weekday,
} from '../types/becoming'
import type { CalendarItem, GuardBand } from '../types/calendar'
import { dayLabel, pad2 } from './dates'
import { capitalize } from './format'

// Words Becoming shows, and the plain-words forms signals and guards are edited in.

export const STAGES: Stage[] = ['experiment', 'trying', 'sticking', 'part']

export const STAGE_LABEL: Record<Stage, string> = {
  experiment: 'Experiment',
  trying: 'Trying',
  sticking: 'Sticking',
  part: 'Part of me',
}

/** The line under each stage column's name. */
export const STAGE_RULE: Record<Stage, string> = {
  experiment: '≤ 4 wks',
  trying: '3+ votes/wk',
  sticking: 'holds on bad weeks',
  part: 'runs itself',
}

/** "I am a writer" → "writer": the identity's short name in sentences. */
export const identityName = (statement: string) => statement.replace(/^\s*I\s*(?:am|'m)\s+(?:an?\s+)?/i, '')

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** An identity kept by guards alone (no signals): "present at home". */
export const keptByGuards = (i: Identity) => i.signals.length === 0 && i.guards.length > 0

/** What today asks for, in words. */
export const targetText = (row: TodayRow) =>
  row.target === 'small' && row.identity.small ? row.identity.small : row.identity.action

/** The small line under the target. */
export function targetSub(row: TodayRow): string {
  const { identity } = row
  const guard = identity.guards[0]
  if (keptByGuards(identity) && guard) return `counts when ${lower(guard.label)} holds`
  if (row.target === 'small' && row.vote?.kind === 'full') return 'small asked · you did the full thing'
  if (row.target === 'small') return `small · full is ${lower(identity.action)}`
  return identity.small ? `full · small is ${lower(identity.small)}` : 'full'
}

const time = (stamp: string) => stamp.slice(11, 16)

export const slotText = (slot: Slot) =>
  slot.guard ? `From ${time(slot.start)}` : `${time(slot.start)}–${time(slot.end)}`

const SOURCE_WORD: Record<VoteSource, string> = {
  auto: 'auto',
  tap: 'tapped',
  palette: '⌘K',
  ntfy: 'phone',
  ai: 'AI',
}
const sourceWord = (s: VoteSource) => SOURCE_WORD[s]

/** What Zync is waiting to see, for an identity nobody voted yet: "auto · when a card hits Done". */
function waitingText(identity: Identity): string {
  const s = identity.signals.find((x) => !('manual' in x))
  if (!s) return ''
  if ('files' in s) return `auto · when you edit ${s.files}`
  if ('event' in s) return `auto · after “${s.event}”`
  if ('workout' in s) return 'auto · when you log a workout'
  return 'auto · when a card hits Done'
}

export type Chip =
  | { tone: 'evid' | 'wait' | 'guard'; text: string }
  /** No vote yet and Zync can't see it: the Full / Small buttons. */
  | { tone: 'vote' }

/** The right-hand chip of a Today row. */
export function rowChip(row: TodayRow): Chip {
  const { vote, identity } = row
  if (vote?.source === 'auto') return { tone: 'evid', text: `auto · ${vote.note ?? vote.kind}` }
  if (vote) return { tone: 'evid', text: `${vote.kind} · ${sourceWord(vote.source)}` }
  const guard = identity.guards[0]
  if (keptByGuards(identity) && guard) return { tone: 'guard', text: `guard · on at ${guard.from}` }
  if (row.manual) return { tone: 'vote' }
  return { tone: 'wait', text: waitingText(identity) }
}

/** Heat-strip cell classes (the design's `.hstrip i`). */
export const STRIP_CLASS: Record<StripCell, string> = { full: 'l3', small: 'l1', none: '', before: 'x' }

export function stripCounts(cells: StripCell[]) {
  const full = cells.filter((c) => c === 'full').length
  const small = cells.filter((c) => c === 'small').length
  return { votes: full + small, full, small, days: cells.filter((c) => c !== 'before').length }
}

/** "31 Aug" from "2026-08-31". */
export const shortDate = (date: string) => dayLabel(new Date(`${date}T00:00`)).slice(4)

/** How far the identity is on its way to the next stage. */
export function progressText(p: StageProgress, identity: Identity): string {
  switch (p.stage) {
    case 'experiment':
      return `Day ${p.day ?? 1} of 28 → then keep or let go`
    case 'trying':
    case 'sticking': {
      const left = Math.max(0, p.weeksNeeded - p.weeks)
      const next = p.stage === 'trying' ? 'Sticking' : 'Part of me'
      if (left === 0) return `Ready for ${next}`
      const weeks = `week${left === 1 ? '' : 's'}`
      return p.stage === 'trying'
        ? `${left} more ${weeks} with ${p.perWeek}+ votes → ${next}`
        : `${left} more steady ${weeks} → ${next}`
    }
    case 'part':
      return `Part of me since ${shortDate(identity.stageSince)}`
  }
}

/** Why Zync suggests the next stage. */
export function suggestionText(p: StageProgress): string {
  if (p.stage === 'experiment') return '28 days in, with enough votes to keep going.'
  return `${p.weeks} weeks in a row with ${p.perWeek}+ votes.`
}

// Signals, edited as chips of plain words.

/** The workout signal's words, offered as a suggestion in the signal chips. */
export const WORKOUT_SIGNAL = 'Workouts logged in Training'

export function signalText(s: Signal): string {
  if ('files' in s) return `editing anything in ${s.files}`
  if ('event' in s) return `calendar event with “${s.event}”`
  if ('manual' in s) return 'voted by hand'
  if ('workout' in s)
    return `${WORKOUT_SIGNAL}${s.workout.minMinutes === undefined ? '' : ` · ${s.workout.minMinutes}+ min`}`
  const parts = [s.card.label ? `labeled ${s.card.label}` : '', s.card.board ? `on ${s.card.board}` : '']
  return `card ${parts.filter(Boolean).join(' ') || 'any'} → done`
}

/**
 * Plain words back into a signal; also accepts "files: X", "event: run", "card: #label", "manual",
 * "workout" and "workout: 30" (full from 30 minutes).
 */
export function parseSignal(text: string): Signal | null {
  const t = text.trim()
  let m = /^(?:editing anything in|files:)\s*(.+)$/i.exec(t)
  if (m?.[1]) return { files: m[1].trim() }
  m = /^(?:calendar event with|event:)\s*[“"]?(.+?)[”"]?$/i.exec(t)
  if (m?.[1]) return { event: m[1].trim() }
  if (/^(voted by hand|manual)$/i.test(t)) return { manual: true }
  m = /^(?:workouts? logged in training|workouts?:?)\s*(?:·\s*)?(?:(\d+)\s*\+?\s*(?:min)?)?$/i.exec(t)
  if (m) return { workout: m[1] ? { minMinutes: Number(m[1]) } : {} }
  m = /^card:?\s*(.*?)(?:\s*→\s*done)?$/i.exec(t)
  if (m) {
    const rest = m[1] ?? ''
    const label = /(?:labeled\s+|#)([\w-]+)/i.exec(rest)?.[1]
    const board = /\bon\s+(.+)$/i.exec(rest)?.[1]?.trim()
    return { card: { ...(label ? { label } : {}), ...(board ? { board } : {}) } }
  }
  return null
}

// Guards, edited as chips: "Present at home · 19:00–24:00 · weekdays".

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WORKWEEK: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']

function daysText(days: Weekday[] | undefined): string {
  if (!days || days.length === 7) return ''
  const set = new Set(days)
  if (days.length === 5 && WORKWEEK.every((d) => set.has(d))) return 'weekdays'
  if (days.length === 2 && set.has('sat') && set.has('sun')) return 'weekends'
  return WEEKDAYS.filter((d) => set.has(d)).join(' ')
}

export function guardText(g: Guard): string {
  const days = daysText(g.days)
  return `${g.label} · ${g.from}–${g.to}${days ? ` · ${days}` : ''}`
}

function parseDays(text: string | undefined): Weekday[] | undefined {
  const t = text?.trim().toLowerCase()
  if (!t || t === 'every day' || t === 'daily') return undefined
  if (t === 'weekdays') return WORKWEEK
  if (t === 'weekends') return ['sat', 'sun']
  const days = WEEKDAYS.filter((d) => t.includes(d))
  return days.length ? days : undefined
}

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/

/** "Label · 19:00–24:00 · weekdays", or "19:00-24:00 Label". Null when it doesn't read as a guard. */
export function parseGuard(text: string): Guard | null {
  const t = text.trim()
  const a = /^(.+?)\s*·\s*(\d\d:\d\d)\s*[–-]\s*(\d\d:\d\d)(?:\s*·\s*(.+))?$/.exec(t)
  const b = /^(\d\d:\d\d)\s*[–-]\s*(\d\d:\d\d)\s+(.+)$/.exec(t)
  const [label, from, to, days] = a ? [a[1], a[2], a[3], a[4]] : b ? [b[3], b[1], b[2], undefined] : []
  if (!label || !from || !to || !CLOCK.test(from) || !CLOCK.test(to) || from >= to) return null
  const d = parseDays(days)
  return { label: label.trim(), from, to, ...(d ? { days: d } : {}) }
}

// Guards across the app.

const WEEKDAY_OF: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const clock = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`

/** How long before a guard the "Move to…" suggestion lands. */
const BEFORE_GUARD = 90

export type GuardHit = { identity: Identity; guard: Guard; suggest: string }

/** The guard a local "YYYY-MM-DDTHH:MM" falls inside, with a time before it to move to. */
export function guardAt(stamp: string, identities: Identity[]): GuardHit | null {
  if (stamp.length < 16) return null
  const day = WEEKDAY_OF[new Date(`${stamp.slice(0, 10)}T00:00`).getDay()] ?? 'sun'
  const t = stamp.slice(11, 16)
  for (const identity of identities)
    for (const guard of identity.guards) {
      if (guard.days && !guard.days.includes(day)) continue
      if (t >= guard.from && t < guard.to)
        return { identity, guard, suggest: clock(Math.max(0, minutes(guard.from) - BEFORE_GUARD)) }
    }
  return null
}

/** Lengths offered for an identity's full version. */
export const MINUTE_OPTIONS = [10, 15, 20, 30, 40, 45, 60, 90, 120]

/** "morning", "midday", "evening" or "HH:MM"; null when it is neither. */
export function parseWhen(text: string): string | null {
  const t = text.trim().toLowerCase()
  if (t === 'morning' || t === 'midday' || t === 'evening') return t
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null
}

/** Every chip parsed, or the first one that doesn't read. */
export function parseAll<T>(values: string[], parse: (t: string) => T | null): { ok: T[] } | { bad: string } {
  const ok: T[] = []
  for (const v of values) {
    const p = parse(v)
    if (p === null) return { bad: v }
    ok.push(p)
  }
  return { ok }
}

/** A page directly in Becoming/ is an identity (Becoming/Mirror/… are the weekly mirrors). */
export const isIdentityPath = (path: string) => /^Becoming\/[^/]+\.md$/.test(path)

/** Each guard's window on the given days ("YYYY-MM-DD"), in minutes, for shading the grid. */
export function guardBands(identities: Identity[], days: string[]): GuardBand[] {
  const out: GuardBand[] = []
  for (const day of days) {
    const weekday = WEEKDAY_OF[new Date(`${day}T00:00`).getDay()] ?? 'sun'
    for (const i of identities)
      for (const g of i.guards)
        if (!g.days || g.days.includes(weekday))
          out.push({ day, from: minutes(g.from), to: minutes(g.to), label: g.label })
  }
  return out
}

/** Where Zync placed each identity, as read-only calendar items (guards are shaded, not blocks). */
export function becomingItems(slots: Slot[], identities: Identity[]): CalendarItem[] {
  const byFile = new Map(identities.map((i) => [i.file, i]))
  const out: CalendarItem[] = []
  for (const s of slots) {
    const identity = byFile.get(s.identity)
    if (!identity || s.guard) continue
    const small =
      identity.small !== undefined && minutes(s.end.slice(11, 16)) - minutes(s.start.slice(11, 16)) < identity.minutes
    out.push({
      id: `becoming:${s.identity}@${s.start}`,
      kind: 'becoming',
      title: `${capitalize(identityName(identity.statement))} · ${lower(small && identity.small ? identity.small : identity.action)}`,
      start: s.start,
      end: s.end,
      allDay: false,
      ref: s.identity,
      file: s.identity,
      editable: false,
      ...(s.movedFrom ? { movedFrom: s.movedFrom } : {}),
    })
  }
  return out
}

/** Mark timed items that fall inside a guard (Becoming's own blocks never do). */
export const markGuarded = (items: CalendarItem[], identities: Identity[]): CalendarItem[] =>
  items.map((i) => {
    if (i.allDay || i.kind === 'becoming') return i
    const hit = guardAt(i.start, identities)
    return hit ? { ...i, warn: hit.guard.label } : i
  })

// The Mirror.

/** Identity colours, in order (the design's --id-* swatches). */
const IDENTITY_COLORS = ['var(--id-writer)', 'var(--id-runner)', 'var(--id-builder)', 'var(--id-present)']
export const identityColor = (index: number) => IDENTITY_COLORS[index % IDENTITY_COLORS.length] ?? 'var(--sage-2)'

/** The Mirror's durations: "2h10", "0h35", "31h". */
export function hoursLabel(total: number): string {
  const m = Math.round(total)
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h${pad2(rest)}` : `${h}h`
}

const utc = (date: string) => new Date(`${date}T00:00:00Z`)
const utcYmd = (d: Date) => d.toISOString().slice(0, 10)

/** ISO week of a day: "2026-W39". */
export function isoWeekOf(date: string): string {
  const d = utc(date)
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
  const thursday = new Date(monday.getTime() + 3 * 86_400_000)
  const year = thursday.getUTCFullYear()
  const jan4 = utc(`${year}-01-04`)
  const firstThursday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000 + 3 * 86_400_000)
  const n = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000)) + 1
  return `${year}-W${pad2(n)}`
}

/** The Monday of "2026-W39", as "YYYY-MM-DD". */
function mondayOfWeek(week: string): string {
  const [y, w] = week.split('-W').map(Number)
  const jan4 = utc(`${y ?? 1970}-01-04`)
  const firstMonday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000)
  return utcYmd(new Date(firstMonday.getTime() + ((w ?? 1) - 1) * 7 * 86_400_000))
}

export const shiftWeek = (week: string, n: number) =>
  isoWeekOf(utcYmd(new Date(utc(mondayOfWeek(week)).getTime() + n * 7 * 86_400_000)))

/** "week 39 · 21–27 Sep" */
export function weekLabel(week: string): string {
  const monday = mondayOfWeek(week)
  const sunday = utcYmd(new Date(utc(monday).getTime() + 6 * 86_400_000))
  const [a, b] = [shortDate(monday), shortDate(sunday)]
  const sameMonth = a.slice(-3) === b.slice(-3)
  return `week ${Number(week.slice(-2))} · ${sameMonth ? a.split(' ')[0] : a}–${b}`
}

/** A span of the day as a bar between 06:00 and 24:00: left and width in %. */
export function dayBar(start: string, end: string): { left: number; width: number } {
  const from = 6 * 60
  const range = 18 * 60
  const a = Math.max(0, minutes(start) - from)
  const b = Math.max(a, minutes(end) - from)
  return { left: (a / range) * 100, width: Math.max(0.8, ((b - a) / range) * 100) }
}

/** A week's Mirror page: Becoming/Mirror/2026-W39.md. */
export const isMirrorPath = (path: string) => /^Becoming\/Mirror\/\d{4}-W\d{2}\.md$/.test(path)
