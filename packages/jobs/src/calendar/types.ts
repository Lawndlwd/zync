import { z } from 'zod'

import { dayField, WHEN_RE, wallClockField } from '../helpers/dates.js'

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

/** Length of a timed event without an `end`, and of a card without a `duration`. */
export const DEFAULT_MINUTES = 60

const when = wallClockField(WHEN_RE, 'must look like 2026-09-28 or 2026-09-28T15:14')
const day = dayField('must look like 2026-09-28')

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

export const EVENT_FIELDS = {
  start: when,
  end: when,
  people: z.array(z.string()),
  repeat: RepeatSchema,
}
type FieldName = keyof typeof EVENT_FIELDS
export const isEventField = (k: string): k is FieldName => Object.hasOwn(EVENT_FIELDS, k)

export type CalendarEvent = {
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
export type EventPatch = {
  title?: string
  start?: string
  end?: string | null
  people?: string[]
  repeat?: Repeat | null
  description?: string
}

export type CalendarKind = 'event' | 'card' | 'card-ai' | 'job' | 'run'

export type CalendarItem = {
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
