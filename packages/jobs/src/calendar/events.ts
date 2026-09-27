import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { badRequest, notFound } from '../errors.js'
import { checkMdFile, freeFileName, listMdFiles } from '../helpers/files.js'
import { safeResolve } from '../workspaces.js'
import { parseEvent, serializeEvent, validateEvent } from './event-file.js'
import { CALENDAR_DIR, type CalendarEvent, type EventPatch, EVENT_FIELDS, RepeatSchema } from './types.js'

const calendarDir = (wsPath: string) => safeResolve(wsPath, CALENDAR_DIR)

export async function listEvents(wsPath: string): Promise<CalendarEvent[]> {
  const dir = await calendarDir(wsPath)
  const out: CalendarEvent[] = []
  for (const file of await listMdFiles(dir)) {
    const src = await readFile(path.join(dir, file), 'utf8').catch(() => null)
    const e = src === null ? null : parseEvent(file, src)
    if (e) out.push(e)
  }
  return out.toSorted((a, b) => a.start.localeCompare(b.start))
}

export async function readEvent(wsPath: string, file: string): Promise<CalendarEvent> {
  const src = await readFile(path.join(await calendarDir(wsPath), checkMdFile(file, 'event')), 'utf8').catch(() => {
    throw notFound(`Unknown event "${file}"`)
  })
  const e = parseEvent(file, src)
  if (!e) throw badRequest(`"${file}" has no valid start`)
  return e
}

function applyPatch(e: CalendarEvent, patch: EventPatch): CalendarEvent {
  const next: CalendarEvent = { ...e }
  if (patch.title !== undefined) next.title = z.string().trim().min(1).max(200).parse(patch.title)
  if (patch.start !== undefined) next.start = EVENT_FIELDS.start.parse(patch.start)
  if (patch.end === null) next.end = undefined
  else if (patch.end !== undefined) next.end = EVENT_FIELDS.end.parse(patch.end)
  if (patch.people !== undefined) next.people = EVENT_FIELDS.people.parse(patch.people)
  if (patch.repeat === null) next.repeat = undefined
  else if (patch.repeat !== undefined) next.repeat = RepeatSchema.parse(patch.repeat)
  if (patch.description !== undefined) next.description = patch.description.trim()
  const managed = Object.keys(patch)
  next.extra = Object.fromEntries(Object.entries(e.extra).filter(([k]) => !managed.includes(k)))
  return validateEvent(next)
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
