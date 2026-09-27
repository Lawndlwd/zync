import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBoard, createCard } from './boards.js'
import {
  addMinutes,
  CALENDAR_DIR,
  calendarRange,
  createEvent,
  deleteEvent,
  eventEnd,
  listEvents,
  occurrences,
  parseEvent,
  updateEvent,
} from './calendar.js'
import { validateJob, writeJob } from './job-file.js'
import { appendRun } from './runs.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'calendar-'))
})

describe('events', () => {
  it('creates, renames with the title, updates and deletes event files', async () => {
    const e = await createEvent(ws, { title: 'Team sync', start: '2026-09-28T14:00', people: ['me'] })
    expect(e.file).toBe('Team sync.md')
    const src = await readFile(path.join(ws, CALENDAR_DIR, 'Team sync.md'), 'utf8')
    expect(src).toMatch(/start: '?2026-09-28T14:00/)

    const moved = await updateEvent(ws, e.file, {
      title: 'Weekly sync',
      start: '2026-09-29T10:00',
      end: '2026-09-29T11:30',
    })
    expect(moved.file).toBe('Weekly sync.md')
    expect(await listEvents(ws)).toMatchObject([{ title: 'Weekly sync', end: '2026-09-29T11:30', people: ['me'] }])

    await deleteEvent(ws, moved.file)
    expect(await listEvents(ws)).toEqual([])
  })

  it('rejects an end before the start or a mix of date and date-time', async () => {
    await expect(createEvent(ws, { title: 'x', start: '2026-09-28T14:00', end: '2026-09-28T13:00' })).rejects.toThrow()
    await expect(createEvent(ws, { title: 'x', start: '2026-09-28', end: '2026-09-28T13:00' })).rejects.toThrow()
  })

  it('keeps unknown frontmatter and ignores pages without a start', () => {
    const e = parseEvent('a.md', '---\nstart: 2026-09-28\nlocation: Office\n---\nnotes')
    expect(e).toMatchObject({ start: '2026-09-28', extra: { location: 'Office' }, description: 'notes' })
    expect(parseEvent('b.md', '# just a page')).toBeNull()
  })

  it('defaults to one hour, or the same day when all-day', () => {
    expect(eventEnd({ start: '2026-09-28T23:30' })).toBe('2026-09-29T00:30')
    expect(eventEnd({ start: '2026-09-28' })).toBe('2026-09-28')
    expect(addMinutes('2026-09-28', 90)).toBe('2026-09-28T01:30')
  })
})

describe('calendarRange', () => {
  it('merges events, cards, AI runs, jobs and past runs in the range', async () => {
    await createEvent(ws, { title: 'Offsite', start: '2026-09-28', end: '2026-09-30' })
    await createEvent(ws, { title: 'Next month', start: '2026-10-20T09:00' })
    await createBoard(ws, { name: 'Sprint' })
    await createCard(ws, 'Sprint', { title: 'Report', due: '2026-09-29T10:00', duration: 90 })
    await createCard(ws, 'Sprint', { title: 'Research', assignee: 'ai', runAt: '2026-09-30T08:00' })
    await writeJob(ws, validateJob({ name: 'daily', schedule: '0 9 * * *', instructions: 'go' }))
    await writeJob(ws, validateJob({ name: 'once', at: '2026-10-01T12:00', instructions: 'go' }))
    await appendRun(ws, 'daily', {
      ts: new Date('2026-09-28T09:00').toISOString(),
      status: 'ok',
      summary: '',
      trigger: 'schedule',
      durationMs: 60_000,
    })

    const items = await calendarRange(ws, '2026-09-28', '2026-10-05')
    const byKind = (k: string) => items.filter((i) => i.kind === k)
    expect(byKind('event').map((i) => [i.title, i.allDay])).toEqual([['Offsite', true]])
    expect(byKind('card')).toMatchObject([
      { title: 'Report', start: '2026-09-29T10:00', end: '2026-09-29T11:30', editable: true },
    ])
    expect(byKind('card-ai')).toMatchObject([{ title: 'Research', start: '2026-09-30T08:00', end: '2026-09-30T08:30' }])
    const daily = byKind('job').filter((i) => i.ref === 'daily')
    expect(daily).toHaveLength(7)
    expect(daily.every((i) => i.recurring && !i.editable && i.start.endsWith('T09:00'))).toBe(true)
    expect(byKind('job').find((i) => i.ref === 'once')).toMatchObject({ start: '2026-10-01T12:00', editable: true })
    expect(byKind('run')).toMatchObject([{ ref: 'daily', status: 'ok' }])
    // The card's linked AI job is shown as the card, not as a job.
    expect(byKind('job').some((i) => i.ref.startsWith('card-'))).toBe(false)
  })

  it('ignores Calendar pages that are not events', async () => {
    await createEvent(ws, { title: 'Real', start: '2026-09-28T09:00' })
    await writeFile(path.join(ws, CALENDAR_DIR, 'README.md'), '# notes')
    expect((await calendarRange(ws, '2026-09-28', '2026-09-29')).map((i) => i.title)).toEqual(['Real'])
  })
})

describe('recurring events', () => {
  const starts = (e: Parameters<typeof occurrences>[0], from: string, to: string) => occurrences(e, from, to)

  it('repeats weekly on chosen days at the same time', () => {
    // 2026-09-28 is a Monday.
    const e = { start: '2026-09-28T05:00', repeat: { every: 'week' as const, days: ['mon' as const, 'fri' as const] } }
    expect(starts(e, '2026-09-28', '2026-10-12')).toEqual([
      '2026-09-28T05:00',
      '2026-10-02T05:00',
      '2026-10-05T05:00',
      '2026-10-09T05:00',
    ])
    // Nothing before the first day.
    expect(starts(e, '2026-09-01', '2026-09-28')).toEqual([])
  })

  it('handles intervals, until, except, months and years', () => {
    const r = (repeat: any, start = '2026-01-31') => ({ start, repeat })
    expect(starts(r({ every: 'day', interval: 3 }, '2026-10-01'), '2026-10-01', '2026-10-08')).toEqual([
      '2026-10-01',
      '2026-10-04',
      '2026-10-07',
    ])
    expect(starts(r({ every: 'week', interval: 2 }, '2026-09-28'), '2026-09-28', '2026-10-26')).toEqual([
      '2026-09-28',
      '2026-10-12',
    ])
    expect(
      starts(
        r({ every: 'day', until: '2026-10-02', except: ['2026-10-01'] }, '2026-09-30'),
        '2026-09-01',
        '2026-11-01',
      ),
    ).toEqual(['2026-09-30', '2026-10-02'])
    // Months without a 31st are skipped.
    expect(starts(r({ every: 'month' }), '2026-01-01', '2026-06-01')).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ])
    expect(starts(r({ every: 'year' }), '2026-01-01', '2029-01-01')).toEqual(['2026-01-31', '2027-01-31', '2028-01-31'])
  })

  it('stores the rule in frontmatter and shows each occurrence on the calendar', async () => {
    const e = await createEvent(ws, {
      title: 'Gym',
      start: '2026-09-28T05:00',
      end: '2026-09-28T06:30',
      repeat: { every: 'week', days: ['fri', 'mon'], interval: 1 },
    })
    const src = await readFile(path.join(ws, 'Calendar/Gym.md'), 'utf8')
    expect(src).toContain('repeat:\n  every: week\n  days:\n    - mon\n    - fri\n')
    expect(src).not.toContain('interval')
    expect(parseEvent('Gym.md', src)?.repeat).toEqual({ every: 'week', days: ['mon', 'fri'] })

    const items = (await calendarRange(ws, '2026-10-01', '2026-10-06')).filter((i) => i.kind === 'event')
    expect(items.map((i) => [i.id, i.start, i.end, i.recurring, i.editable])).toEqual([
      ['event:Calendar/Gym.md@2026-10-02', '2026-10-02T05:00', '2026-10-02T06:30', true, false],
      ['event:Calendar/Gym.md@2026-10-05', '2026-10-05T05:00', '2026-10-05T06:30', true, false],
    ])

    await updateEvent(ws, e.file, { repeat: null })
    expect(await readFile(path.join(ws, 'Calendar/Gym.md'), 'utf8')).not.toContain('repeat')
  })
})
