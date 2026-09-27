import { addDays, addMinutes, daysApart, isDate } from '../helpers/dates.js'
import { repeatsOn } from './repeat.js'
import { type CalendarEvent, DEFAULT_MINUTES } from './types.js'

/** Cap on generated occurrences (recurring events, cron jobs) per range. */
export const MAX_OCCURRENCES = 500

/** When the event ends: `end`, or 1 hour after a timed start, or the start day for all-day events. */
export function eventEnd(e: Pick<CalendarEvent, 'start' | 'end'>): string {
  if (e.end) return e.end
  return isDate(e.start) ? e.start : addMinutes(e.start, DEFAULT_MINUTES)
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
