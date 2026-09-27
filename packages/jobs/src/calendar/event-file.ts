import path from 'node:path'

import { badRequest } from '../errors.js'
import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'
import { isDate } from '../helpers/dates.js'
import { cleanRepeat } from './repeat.js'
import { type CalendarEvent, EVENT_FIELDS, isEventField } from './types.js'

/** Lenient: a page without a valid `start` is not an event (returns null). */
export function parseEvent(file: string, source: string): CalendarEvent | null {
  let parsed: ReturnType<typeof parseFrontmatter>
  try {
    parsed = parseFrontmatter(source)
  } catch {
    return null
  }
  const { data, content } = parsed
  const event: CalendarEvent = {
    file,
    title: path.basename(file, '.md'),
    start: '',
    people: [],
    description: content.trim(),
    extra: {},
  }
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const r = isEventField(k) ? EVENT_FIELDS[k].safeParse(v) : undefined
    if (r?.success) fields[k] = r.data
    else event.extra[k] = v
  }
  Object.assign(event, fields)
  return event.start ? event : null
}

export function serializeEvent(event: CalendarEvent): string {
  const meta: Record<string, unknown> = { start: event.start }
  if (event.end) meta.end = event.end
  if (event.people.length) meta.people = event.people
  if (event.repeat) meta.repeat = cleanRepeat(event.repeat)
  for (const [k, v] of Object.entries(event.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  return stringifyFrontmatter(meta, event.description)
}

export function validateEvent(e: CalendarEvent): CalendarEvent {
  if (e.end && isDate(e.start) !== isDate(e.end)) {
    throw badRequest('start and end must both be dates (all-day) or both be date-times')
  }
  if (e.end && e.end < e.start) throw badRequest('end must not be before start')
  return e
}
