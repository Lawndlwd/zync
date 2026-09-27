import { access, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Cron } from 'croner'
import matter from 'gray-matter'
import { z } from 'zod'
import { AI_ASSIGNEE, listBoards, listCards, localStamp, safeName } from './boards.js'
import { defaultTimezone, listJobs } from './job-file.js'
import { readRuns } from './runs.js'
import { safeResolve } from './workspaces.js'

// Calendar events are ordinary markdown pages in the workspace's `Calendar/` folder: the file name
// is the title, the frontmatter holds the times, the body holds the notes.
//
//   <ws>/Calendar/Team sync.md
//   ---
//   start: 2026-09-28T14:00      # or 2026-09-28 for an all-day event
//   end: 2026-09-28T15:30        # optional: 1 hour (all-day: the same day) when unset
//   people: [me, sara]
//   repeat:                      # optional: a recurring event
//     every: week                # day | week | month | year
//     days: [mon, fri]           # weekly: which days (default: the start's weekday)
//     interval: 2                # every 2 weeks (default 1)
//     until: 2026-12-31          # last possible day (optional)
//     except: [2026-10-09]       # skipped occurrences (optional)
//   ---
//   Agenda…
//
// All times are local wall-clock strings (no timezone), like card `due` / `runAt`.
//
// `calendarRange` merges events with everything else that has a time: cards (`due`, AI `runAt`),
// scheduled jobs (one-shot and each cron occurrence) and past runs.

export const CALENDAR_DIR = 'Calendar'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WHEN_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/
const DEFAULT_MINUTES = 60
const AI_MINUTES = 30
const JOB_MINUTES = 30
const MAX_OCCURRENCES = 500

// YAML turns unquoted dates into Date objects; normalise back to a string.
const when = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10) : v),
  z.string().regex(WHEN_RE, { message: 'must look like 2026-09-28 or 2026-09-28T15:14' }),
)

const day = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(DATE_RE, { message: 'must look like 2026-09-28' }),
)

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const RepeatSchema = z.object({
  every: z.enum(['day', 'week', 'month', 'year']),
  interval: z.number().int().min(1).max(99).optional(),
  days: z.array(z.enum(WEEKDAYS)).optional(),
  until: day.optional(),
  except: z.array(day).optional(),
})
export type Repeat = z.infer<typeof RepeatSchema>

const FIELDS = {
  start: when,
  end: when,
  people: z.array(z.string()),
  repeat: RepeatSchema,
}
type FieldName = keyof typeof FIELDS

export interface CalendarEvent {
  /** File name inside Calendar/, e.g. "Team sync.md". */
  file: string
  title: string
  start: string
  end?: string
  people: string[]
  repeat?: Repeat
  description: string
  /** Frontmatter keys we don't manage, preserved on write. */
  extra: Record<string, unknown>
}

/** `null` clears an optional field. */
export interface EventPatch {
  title?: string
  start?: string
  end?: string | null
  people?: string[]
  repeat?: Repeat | null
  description?: string
}

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 })
const badRequest = (msg: string) => Object.assign(new Error(msg), { status: 400 })

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  )

// ── wall-clock arithmetic on "YYYY-MM-DD[THH:MM]" strings ──────────────────

const isDate = (s: string) => DATE_RE.test(s)
const asUtc = (s: string) => new Date(`${isDate(s) ? `${s}T00:00` : s.slice(0, 16)}:00Z`)

export function addMinutes(stamp: string, minutes: number): string {
  return new Date(asUtc(stamp).getTime() + minutes * 60_000).toISOString().slice(0, 16)
}

export function addDays(date: string, days: number): string {
  return new Date(asUtc(date).getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

// ── events ─────────────────────────────────────────────────────────────────

function checkEventFile(file: string): string {
  if (!file.endsWith('.md') || file.includes('/') || file.includes('\\') || file.startsWith('.')) {
    throw notFound(`Unknown event "${file}"`)
  }
  return file
}

const calendarDir = (wsPath: string) => safeResolve(wsPath, CALENDAR_DIR)

/** Lenient: a page without a valid `start` is not an event (returns null). */
export function parseEvent(file: string, source: string): CalendarEvent | null {
  let data: Record<string, unknown> = {}
  let content = source
  try {
    const parsed = matter(source)
    data = { ...parsed.data }
    content = parsed.content
  } catch {
    return null
  }
  const event: CalendarEvent = {
    file,
    title: path.basename(file, '.md'),
    start: '',
    people: [],
    description: content.trim(),
    extra: {},
  }
  const out = event as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(data)) {
    const r = FIELDS[k as FieldName]?.safeParse(v)
    if (r?.success) out[k] = r.data
    else event.extra[k] = v
  }
  return event.start ? event : null
}

export function serializeEvent(event: CalendarEvent): string {
  const meta: Record<string, unknown> = { start: event.start }
  if (event.end) meta.end = event.end
  if (event.people.length) meta.people = event.people
  if (event.repeat) meta.repeat = cleanRepeat(event.repeat)
  for (const [k, v] of Object.entries(event.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  return matter.stringify(event.description ? `\n${event.description}\n` : '', meta)
}

/** When the event ends: `end`, or 1 hour after a timed start, or the start day for all-day events. */
export function eventEnd(e: Pick<CalendarEvent, 'start' | 'end'>): string {
  if (e.end) return e.end
  return isDate(e.start) ? e.start : addMinutes(e.start, DEFAULT_MINUTES)
}

/** Only what differs from the defaults, in a stable key order. */
function cleanRepeat(r: Repeat): Repeat {
  const out: Repeat = { every: r.every }
  if (r.interval && r.interval > 1) out.interval = r.interval
  if (r.every === 'week' && r.days?.length) out.days = WEEKDAYS.filter((d) => r.days?.includes(d))
  if (r.until) out.until = r.until
  if (r.except?.length) out.except = [...new Set(r.except)].sort()
  return out
}

const weekday = (date: string): Weekday => WEEKDAYS[asUtc(date).getUTCDay()]
const daysApart = (a: string, b: string) => Math.round((asUtc(b).getTime() - asUtc(a).getTime()) / 86_400_000)
const mondayOf = (date: string) => addDays(date, -((asUtc(date).getUTCDay() + 6) % 7))

/** Does a recurring event (first day `first`) happen on `date`? */
function repeatsOn(r: Repeat, first: string, date: string): boolean {
  const n = r.interval ?? 1
  if (date < first || (r.until && date > r.until) || r.except?.includes(date)) return false
  const [y0, m0, d0] = first.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
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

/**
 * Start stamps of an event's occurrences that overlap the dates [from, to): just `start` for a
 * one-off event; for a recurring one, every matching day with the same time and length.
 */
export function occurrences(e: Pick<CalendarEvent, 'start' | 'end' | 'repeat'>, from: string, to: string): string[] {
  if (!e.repeat) return [e.start]
  const first = e.start.slice(0, 10)
  const time = e.start.slice(10)
  const spanDays = daysApart(first, eventEnd(e).slice(0, 10))
  const out: string[] = []
  let date = addDays(from, -spanDays - 1)
  if (date < first) date = first
  for (; date < to && out.length < MAX_OCCURRENCES; date = addDays(date, 1)) {
    if (e.repeat.until && date > e.repeat.until) break
    if (repeatsOn(e.repeat, first, date)) out.push(date + time)
  }
  return out
}

function validate(e: CalendarEvent): CalendarEvent {
  if (e.end && isDate(e.start) !== isDate(e.end)) {
    throw badRequest('start and end must both be dates (all-day) or both be date-times')
  }
  if (e.end && e.end < e.start) throw badRequest('end must not be before start')
  return e
}

export async function listEvents(wsPath: string): Promise<CalendarEvent[]> {
  const dir = await calendarDir(wsPath)
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const out: CalendarEvent[] = []
  for (const d of entries) {
    if (!d.isFile() || !d.name.endsWith('.md') || d.name.startsWith('.')) continue
    const src = await readFile(path.join(dir, d.name), 'utf8').catch(() => null)
    const e = src === null ? null : parseEvent(d.name, src)
    if (e) out.push(e)
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

export async function readEvent(wsPath: string, file: string): Promise<CalendarEvent> {
  const src = await readFile(path.join(await calendarDir(wsPath), checkEventFile(file)), 'utf8').catch(() => {
    throw notFound(`Unknown event "${file}"`)
  })
  const e = parseEvent(file, src)
  if (!e) throw badRequest(`"${file}" has no valid start`)
  return e
}

async function freeFileName(dir: string, title: string, current?: string): Promise<string> {
  const base = safeName(title)
  for (let i = 1; ; i++) {
    const file = i === 1 ? `${base}.md` : `${base} ${i}.md`
    if (file === current || !(await exists(path.join(dir, file)))) return file
  }
}

function applyPatch(e: CalendarEvent, patch: EventPatch): CalendarEvent {
  const next: CalendarEvent = { ...e }
  if (patch.title !== undefined) next.title = z.string().trim().min(1).max(200).parse(patch.title)
  if (patch.start !== undefined) next.start = FIELDS.start.parse(patch.start) as string
  if (patch.end === null) next.end = undefined
  else if (patch.end !== undefined) next.end = FIELDS.end.parse(patch.end) as string
  if (patch.people !== undefined) next.people = FIELDS.people.parse(patch.people)
  if (patch.repeat === null) next.repeat = undefined
  else if (patch.repeat !== undefined) next.repeat = RepeatSchema.parse(patch.repeat)
  if (patch.description !== undefined) next.description = String(patch.description).trim()
  const managed = Object.keys(patch)
  next.extra = Object.fromEntries(Object.entries(e.extra).filter(([k]) => !managed.includes(k)))
  return validate(next)
}

export async function createEvent(
  wsPath: string,
  input: EventPatch & { title: string; start: string },
): Promise<CalendarEvent> {
  const dir = await calendarDir(wsPath)
  await mkdir(dir, { recursive: true })
  const blank: CalendarEvent = { file: '', title: '', start: '', people: [], description: '', extra: {} }
  const event = applyPatch(blank, input)
  event.file = await freeFileName(dir, event.title)
  await writeFile(path.join(dir, event.file), serializeEvent(event))
  return event
}

export async function updateEvent(wsPath: string, file: string, patch: EventPatch): Promise<CalendarEvent> {
  const dir = await calendarDir(wsPath)
  const current = await readEvent(wsPath, file)
  let event = applyPatch(current, patch)
  // The file name follows the title.
  if (event.title !== current.title) {
    const next = await freeFileName(dir, event.title, current.file)
    if (next !== current.file) {
      await rename(path.join(dir, current.file), path.join(dir, next))
      event = { ...event, file: next }
    }
  }
  await writeFile(path.join(dir, event.file), serializeEvent(event))
  return event
}

export async function deleteEvent(wsPath: string, file: string): Promise<void> {
  await readEvent(wsPath, file)
  await rm(path.join(await calendarDir(wsPath), file))
}

// ── everything with a time ─────────────────────────────────────────────────

export type CalendarKind = 'event' | 'card' | 'card-ai' | 'job' | 'run'

export interface CalendarItem {
  /** Stable key, e.g. "event:Calendar/Team sync.md" or "job:weekly@2026-09-28T09:00". */
  id: string
  kind: CalendarKind
  title: string
  /** "YYYY-MM-DD" when all-day, else "YYYY-MM-DDTHH:MM". */
  start: string
  /** Inclusive last day when all-day, else the end time. */
  end: string
  allDay: boolean
  /** Workspace-relative file (events, cards) or the job name (jobs, runs). */
  ref: string
  /** Cards: board folder and file name. */
  board?: string
  file?: string
  assignee?: string
  people?: string[]
  /** Cards: column id. Runs: ok | failed | timeout | skipped. */
  status?: string
  /** Card AI state (scheduled, running, done, failed). */
  ai?: string
  /** Recurring job occurrence: can't be moved on its own. */
  recurring?: boolean
  /** Can be moved (and, for events and cards, resized) from the calendar. */
  editable: boolean
}

/**
 * Every item overlapping the local dates [from, to) — `to` exclusive, both "YYYY-MM-DD".
 * Sorted by start.
 */
export async function calendarRange(wsPath: string, from: string, to: string): Promise<CalendarItem[]> {
  if (!isDate(from) || !isDate(to) || to <= from) throw badRequest('from and to must be dates with from < to')
  const out: CalendarItem[] = []
  const overlaps = (start: string, end: string) => start < to && (isDate(end) ? end >= from : end > from)

  for (const e of await listEvents(wsPath)) {
    const firstEnd = eventEnd(e)
    const allDay = isDate(e.start)
    const length = allDay
      ? daysApart(e.start, firstEnd)
      : (asUtc(firstEnd).getTime() - asUtc(e.start).getTime()) / 60_000
    for (const start of occurrences(e, from, to)) {
      const end = e.repeat ? (allDay ? addDays(start, length) : addMinutes(start, length)) : firstEnd
      if (!overlaps(start, end)) continue
      out.push({
        id: `event:${CALENDAR_DIR}/${e.file}${e.repeat ? `@${start.slice(0, 10)}` : ''}`,
        kind: 'event',
        title: e.title,
        start,
        end,
        allDay,
        ref: `${CALENDAR_DIR}/${e.file}`,
        file: e.file,
        people: e.people,
        // An occurrence moves with its series: change the times in the event itself.
        ...(e.repeat ? { recurring: true, editable: false } : { editable: true }),
      })
    }
  }

  const cardTitles = new Map<string, string>()
  for (const board of await listBoards(wsPath)) {
    for (const c of await listCards(wsPath, board.path)) {
      const ref = `${board.path}/${c.file}`
      cardTitles.set(ref, c.title)
      const base = { title: c.title, ref, board: board.path, file: c.file, assignee: c.assignee, ai: c.ai?.state }
      const status = c.status ?? board.columns[0]?.id
      if (c.due) {
        const allDay = isDate(c.due)
        const end = allDay ? c.due : addMinutes(c.due, c.duration ?? DEFAULT_MINUTES)
        if (overlaps(c.due, end))
          out.push({ ...base, id: `card:${ref}`, kind: 'card', start: c.due, end, allDay, status, editable: true })
      }
      if (c.assignee === AI_ASSIGNEE && c.runAt) {
        const start = c.runAt.slice(0, 16)
        const end = addMinutes(start, c.duration ?? AI_MINUTES)
        if (overlaps(start, end))
          out.push({
            ...base,
            id: `card-ai:${ref}`,
            kind: 'card-ai',
            start,
            end,
            allDay: false,
            status,
            editable: true,
          })
      }
    }
  }

  // Cron occurrences are computed a day either side of the range, then filtered on local time, so a
  // job timezone that differs from the server's can't drop edge occurrences.
  const fromDate = new Date(asUtc(addDays(from, -1)).getTime())
  const toLocal = addDays(to, 1)
  for (const entry of await listJobs(wsPath)) {
    const job = entry.job
    if (!job) continue
    const tz = job.timezone || defaultTimezone()
    if (!job.card && job.enabled) {
      if (job.at) {
        // A bare `at` is already local wall-clock time in the job's timezone.
        const local = /(Z|[+-]\d{2}:\d{2})$/i.test(job.at) ? localStamp(new Date(job.at), tz) : job.at.slice(0, 16)
        const end = addMinutes(local, JOB_MINUTES)
        if (overlaps(local, end))
          out.push({
            id: `job:${job.name}`,
            kind: 'job',
            title: job.name,
            start: local,
            end,
            allDay: false,
            ref: job.name,
            editable: true,
          })
      } else if (job.schedule) {
        const cron = new Cron(job.schedule, { timezone: tz, paused: true })
        let prev: Date = fromDate
        for (let i = 0; i < MAX_OCCURRENCES; i++) {
          const next = cron.nextRun(prev)
          if (!next) break
          const local = localStamp(next, tz)
          if (local >= toLocal) break
          prev = next
          const end = addMinutes(local, JOB_MINUTES)
          if (!overlaps(local, end)) continue
          out.push({
            id: `job:${job.name}@${local}`,
            kind: 'job',
            title: job.name,
            start: local,
            end,
            allDay: false,
            ref: job.name,
            recurring: true,
            editable: false,
          })
        }
        cron.stop()
      }
    }
    for (const run of await readRuns(wsPath, entry.name, 1000)) {
      const start = localStamp(new Date(run.ts), tz)
      const end = addMinutes(start, Math.max(15, Math.round((run.durationMs ?? 0) / 60_000)))
      if (!overlaps(start, end)) continue
      out.push({
        id: `run:${entry.name}@${run.ts}`,
        kind: 'run',
        title: job.card ? (cardTitles.get(job.card) ?? path.posix.basename(job.card, '.md')) : job.name,
        start,
        end,
        allDay: false,
        ref: entry.name,
        ...(job.card ? { board: path.posix.dirname(job.card), file: path.posix.basename(job.card) } : {}),
        status: run.status,
        editable: false,
      })
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}
