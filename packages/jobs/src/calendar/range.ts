import path from 'node:path'

import { Cron } from 'croner'

import { AI_ASSIGNEE, firstColumn, listBoards, listCards } from '../boards/index.js'
import { badRequest } from '../errors.js'
import { addDays, addMinutes, asUtc, daysApart, defaultTimezone, isDate, localStamp } from '../helpers/dates.js'
import { listJobs } from '../job-file.js'
import { readRuns } from '../runs.js'
import { listEvents } from './events.js'
import { eventEnd, MAX_OCCURRENCES, occurrences } from './occurrences.js'
import { CALENDAR_DIR, type CalendarItem, DEFAULT_MINUTES } from './types.js'

const AI_MINUTES = 30
const JOB_MINUTES = 30

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
      const status = c.status ?? firstColumn(board)
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

  return out.toSorted((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}
