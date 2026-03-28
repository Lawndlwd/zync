import { z } from 'zod'
import { getCalendarClient } from './google-auth.js'

// --- calendar_list_events ---

export const calendarListEventsSchema = z.object({
  days: z.number().default(7).describe('Number of days ahead to look (default 7)'),
  max_results: z.number().default(25).describe('Maximum number of events (default 25)'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default "primary")'),
})

export async function calendarListEvents(input: z.infer<typeof calendarListEventsSchema>): Promise<string> {
  const cal = getCalendarClient()
  const now = new Date()
  const until = new Date(now.getTime() + input.days * 86400_000)

  const res = await cal.events.list({
    calendarId: input.calendar_id,
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    maxResults: input.max_results,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = (res.data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || '',
    description: e.description ? e.description.slice(0, 200) : '',
    attendees: (e.attendees || []).map((a) => ({ email: a.email, response: a.responseStatus })),
    htmlLink: e.htmlLink || '',
    status: e.status || '',
  }))

  return JSON.stringify({ count: events.length, events })
}

// --- calendar_create_event ---

export const calendarCreateEventSchema = z.object({
  summary: z.string().describe('Event title'),
  start_time: z.string().describe('Start time in ISO 8601 format (e.g. 2025-01-15T10:00:00+01:00)'),
  end_time: z.string().describe('End time in ISO 8601 format'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location'),
  attendees: z.array(z.string()).optional().describe('List of attendee email addresses'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default "primary")'),
})

export async function calendarCreateEvent(input: z.infer<typeof calendarCreateEventSchema>): Promise<string> {
  const cal = getCalendarClient()

  const event: any = {
    summary: input.summary,
    start: { dateTime: input.start_time },
    end: { dateTime: input.end_time },
  }
  if (input.description) event.description = input.description
  if (input.location) event.location = input.location
  if (input.attendees?.length) {
    event.attendees = input.attendees.map((email) => ({ email }))
  }

  const res = await cal.events.insert({
    calendarId: input.calendar_id,
    requestBody: event,
  })

  return JSON.stringify({
    success: true,
    id: res.data.id,
    htmlLink: res.data.htmlLink,
    summary: res.data.summary,
  })
}

// --- calendar_update_event ---

export const calendarUpdateEventSchema = z.object({
  event_id: z.string().describe('Event ID to update'),
  summary: z.string().optional().describe('New event title'),
  start_time: z.string().optional().describe('New start time in ISO 8601'),
  end_time: z.string().optional().describe('New end time in ISO 8601'),
  description: z.string().optional().describe('New description'),
  location: z.string().optional().describe('New location'),
  attendees: z.array(z.string()).optional().describe('Updated attendee emails (replaces existing)'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default "primary")'),
})

export async function calendarUpdateEvent(input: z.infer<typeof calendarUpdateEventSchema>): Promise<string> {
  const cal = getCalendarClient()

  // Fetch existing event first
  const _existing = await cal.events.get({
    calendarId: input.calendar_id,
    eventId: input.event_id,
  })

  const patch: any = {}
  if (input.summary !== undefined) patch.summary = input.summary
  if (input.start_time) patch.start = { dateTime: input.start_time }
  if (input.end_time) patch.end = { dateTime: input.end_time }
  if (input.description !== undefined) patch.description = input.description
  if (input.location !== undefined) patch.location = input.location
  if (input.attendees) patch.attendees = input.attendees.map((email) => ({ email }))

  const res = await cal.events.patch({
    calendarId: input.calendar_id,
    eventId: input.event_id,
    requestBody: patch,
  })

  return JSON.stringify({
    success: true,
    id: res.data.id,
    summary: res.data.summary,
  })
}

// --- calendar_delete_event ---

export const calendarDeleteEventSchema = z.object({
  event_id: z.string().describe('Event ID to delete'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default "primary")'),
})

export async function calendarDeleteEvent(input: z.infer<typeof calendarDeleteEventSchema>): Promise<string> {
  const cal = getCalendarClient()

  await cal.events.delete({
    calendarId: input.calendar_id,
    eventId: input.event_id,
  })

  return JSON.stringify({ success: true, deleted: input.event_id })
}

// --- calendar_search_events ---

export const calendarSearchEventsSchema = z.object({
  query: z.string().describe('Free-text search query for events'),
  days_back: z.number().default(30).describe('Days to search back (default 30)'),
  days_forward: z.number().default(30).describe('Days to search forward (default 30)'),
  max_results: z.number().default(25).describe('Maximum number of results (default 25)'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default "primary")'),
})

export async function calendarSearchEvents(input: z.infer<typeof calendarSearchEventsSchema>): Promise<string> {
  const cal = getCalendarClient()
  const now = new Date()
  const from = new Date(now.getTime() - input.days_back * 86400_000)
  const until = new Date(now.getTime() + input.days_forward * 86400_000)

  const res = await cal.events.list({
    calendarId: input.calendar_id,
    timeMin: from.toISOString(),
    timeMax: until.toISOString(),
    q: input.query,
    maxResults: input.max_results,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = (res.data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || '',
    description: e.description ? e.description.slice(0, 200) : '',
    htmlLink: e.htmlLink || '',
  }))

  return JSON.stringify({ count: events.length, events })
}
