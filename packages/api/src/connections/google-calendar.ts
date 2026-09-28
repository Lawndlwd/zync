import { addDays, type Connection, defaultTimezone, type ExternalEvent } from '@zync/jobs'
import { z } from 'zod'

import { fetchJson } from './http.js'

// Google Calendar, read-only (calendar.readonly): the primary calendar of each account, in zync's
// time zone so times come back as the same local wall-clock strings as zync's own events.

const WhenSchema = z.object({ date: z.string().optional(), dateTime: z.string().optional() })
const EventSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  htmlLink: z.string().default('https://calendar.google.com'),
  start: WhenSchema,
  end: WhenSchema,
})
export type GoogleEvent = z.infer<typeof EventSchema>
const ListSchema = z.object({ items: z.array(EventSchema).default([]) })

/** null for cancelled events and those without a start. */
export function externalEvent(c: Connection, e: GoogleEvent): ExternalEvent | null {
  if (e.status === 'cancelled') return null
  const base = {
    connection: c.id,
    account: c.account,
    id: e.id,
    title: e.summary || '(no title)',
    link: e.htmlLink,
    ...(e.location ? { location: e.location } : {}),
  }
  if (e.start.date) {
    // All-day: Google's end date is exclusive, zync's is the last day.
    const end = e.end.date ? addDays(e.end.date, -1) : e.start.date
    return { ...base, start: e.start.date, end: end < e.start.date ? e.start.date : end, allDay: true }
  }
  if (!e.start.dateTime) return null
  // Asked in zync's time zone, Google answers "2026-09-28T14:00:00+02:00": the first 16 characters
  // are the local wall clock.
  const start = e.start.dateTime.slice(0, 16)
  return { ...base, start, end: e.end.dateTime?.slice(0, 16) ?? start, allDay: false }
}

/** Events touching the days from `from` to `to` (exclusive), "YYYY-MM-DD". */
export async function listEvents(c: Connection, token: string, from: string, to: string): Promise<ExternalEvent[]> {
  // A day wider on each side in UTC, then cut to the exact local days below.
  const q = new URLSearchParams({
    timeMin: `${addDays(from, -1)}T00:00:00Z`,
    timeMax: `${addDays(to, 1)}T00:00:00Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    timeZone: defaultTimezone(),
  })
  const list = await fetchJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, ListSchema, {
    token,
  })
  return list.items.flatMap((e) => {
    const x = externalEvent(c, e)
    return x && x.start.slice(0, 10) < to && x.end.slice(0, 10) >= from ? [x] : []
  })
}
