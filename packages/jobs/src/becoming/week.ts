import { z } from 'zod'

import { addDays, asUtc, localStamp, mondayOf } from '../helpers/dates.js'
import { readActivity, sessions } from './activity.js'
import { evidenceFor, keptByGuards } from './evidence.js'
import { listIdentities } from './store.js'
import { zyncBusy } from './today.js'
import type { Activity, Busy, Identity } from './types.js'
import { readVotes, standingVotes, voteKey } from './votes.js'
import { votesOnWorkouts, workoutsDone } from './workouts.js'

// The week behind the Mirror: where the tracked hours went, per identity and unclaimed, computed
// from what Zync saw. The AI only writes the words on top.

const WEEK_RE = /^(\d{4})-W(\d{2})$/

/** "2026-W39" for a day, ISO weeks (Monday first, week 1 holds the first Thursday). */
export function isoWeek(date: string): string {
  const thursday = addDays(mondayOf(date), 3)
  const year = Number(thursday.slice(0, 4))
  const firstThursday = addDays(mondayOf(`${year}-01-04`), 3)
  const n = Math.round((asUtc(thursday).getTime() - asUtc(firstThursday).getTime()) / (7 * 86_400_000)) + 1
  return `${year}-W${String(n).padStart(2, '0')}`
}

/** The Monday of an ISO week; null when `week` doesn't look like "2026-W39". */
export function weekMonday(week: string): string | null {
  const m = WEEK_RE.exec(week)
  if (!m) return null
  const firstMonday = mondayOf(`${m[1]}-01-04`)
  return addDays(firstMonday, (Number(m[2]) - 1) * 7)
}

const WindowSpanSchema = z.object({ date: z.string(), start: z.string(), end: z.string() })
export type WindowSpan = z.infer<typeof WindowSpanSchema>

const IdentityWeekSchema = z.object({
  file: z.string(),
  statement: z.string(),
  /** Minutes Zync saw: time in the identity's folders, matching calendar events and workouts. */
  minutes: z.number(),
  votes: z.number(),
  full: z.number(),
  small: z.number(),
  /** Cards that reached Done and vote for it. */
  cards: z.number(),
  /** When it happened (sessions and events), for "when writing happened". */
  spans: z.array(WindowSpanSchema),
  /** Guard identities: the days the guard held. */
  kept: z.array(z.string()).optional(),
})
export type IdentityWeek = z.infer<typeof IdentityWeekSchema>

export const BecomingWeekSchema = z.object({
  week: z.string(),
  from: z.string(),
  /** Sunday. */
  to: z.string(),
  /** Days of the week up to today (a week in progress has fewer than 7). */
  daysTracked: z.number(),
  identities: z.array(IdentityWeekSchema),
  /** Timed events no identity claims. */
  unclaimed: z.object({
    minutes: z.number(),
    recurringMinutes: z.number(),
    events: z.array(z.object({ title: z.string(), minutes: z.number(), recurring: z.boolean() })),
  }),
  trackedMinutes: z.number(),
})
export type BecomingWeek = z.infer<typeof BecomingWeekSchema>

const minutesOf = (b: Busy) => Math.max(0, (asUtc(b.end).getTime() - asUtc(b.start).getTime()) / 60_000)

function filesSpans(identity: Identity, activity: Activity[]): WindowSpan[] {
  const folders = identity.signals.flatMap((s) =>
    'files' in s ? [s.files.replace(/^\.\//, '').replace(/\/+$/, '')] : [],
  )
  if (folders.length === 0) return []
  const edits = activity.filter(
    (a) => a.kind === 'edit' && folders.some((f) => f === '' || a.path === f || a.path.startsWith(`${f}/`)),
  )
  const byDay = new Map<string, Activity[]>()
  for (const e of edits) byDay.set(e.t.slice(0, 10), [...(byDay.get(e.t.slice(0, 10)) ?? []), e])
  return [...byDay.entries()].flatMap(([date, list]) =>
    sessions(list).map((s) => ({ date, start: s.start.slice(11, 16), end: addMinutesClock(s.end, 5) })),
  )
}

const addMinutesClock = (stamp: string, m: number) => {
  const d = new Date(asUtc(stamp).getTime() + m * 60_000)
  return d.toISOString().slice(11, 16)
}

const spanMinutes = (s: WindowSpan) =>
  Number(s.end.slice(0, 2)) * 60 +
  Number(s.end.slice(3, 5)) -
  Number(s.start.slice(0, 2)) * 60 -
  Number(s.start.slice(3, 5))

const matchesEvent = (identity: Identity, title: string) =>
  identity.signals.some((s) => 'event' in s && title.toLowerCase().includes(s.event.toLowerCase()))

/**
 * The week of `week` ("2026-W39"): per identity the minutes, votes and when it happened, plus the
 * unclaimed meeting time (recurring ones are declinable). `external` adds the connected calendars.
 */
export async function becomingWeek(
  wsPath: string,
  week: string,
  external: Busy[] = [],
  now = localStamp(),
): Promise<BecomingWeek> {
  const from = weekMonday(week) ?? mondayOf(now.slice(0, 10))
  const to = addDays(from, 6)
  const end = addDays(to, 1)
  const [identities, votes, activity, own, workouts] = await Promise.all([
    listIdentities(wsPath),
    readVotes(wsPath),
    readActivity(wsPath, from, end),
    zyncBusy(wsPath, from, end),
    workoutsDone(wsPath, from, end),
  ])
  const events = [...own, ...external].filter((e) => e.start >= from && e.start < end)
  const standing = standingVotes(votes)
  const today = now.slice(0, 10)
  const days: string[] = []
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) days.push(d)

  const out: IdentityWeek[] = identities.map((identity) => {
    const mine = events.filter((e) => matchesEvent(identity, e.title))
    const spans = [
      ...filesSpans(identity, activity),
      ...mine.map((e) => ({ date: e.start.slice(0, 10), start: e.start.slice(11, 16), end: e.end.slice(11, 16) })),
      ...(votesOnWorkouts(identity) ? workouts.map((w) => ({ date: w.date, start: w.start, end: w.end })) : []),
    ].toSorted((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
    const cast = days.map((d) => standing.get(voteKey(d, identity.file)))
    const cards = activity.filter(
      (a) =>
        a.kind === 'card-done' &&
        identity.signals.some(
          (s) =>
            'card' in s &&
            (s.card.label === undefined || (a.labels ?? []).includes(s.card.label)) &&
            (s.card.board === undefined || a.path.startsWith(`${s.card.board.replace(/\/+$/, '')}/`)),
        ),
    ).length
    const kept = keptByGuards(identity)
      ? days.filter((date) => evidenceFor(identity, { date, activity, events, now }) !== null)
      : undefined
    return {
      file: identity.file,
      statement: identity.statement,
      minutes: spans.reduce((sum, s) => sum + Math.max(0, spanMinutes(s)), 0),
      votes: cast.filter(Boolean).length,
      full: cast.filter((v) => v?.kind === 'full').length,
      small: cast.filter((v) => v?.kind === 'small').length,
      cards,
      spans,
      ...(kept ? { kept } : {}),
    }
  })

  const claimed = (e: Busy) => identities.some((i) => matchesEvent(i, e.title))
  const unclaimedEvents = events
    .filter((e) => !claimed(e) && e.start.length > 10)
    .map((e) => ({ title: e.title, minutes: minutesOf(e), recurring: e.recurring === true }))
  const unclaimed = {
    minutes: unclaimedEvents.reduce((s, e) => s + e.minutes, 0),
    recurringMinutes: unclaimedEvents.filter((e) => e.recurring).reduce((s, e) => s + e.minutes, 0),
    events: unclaimedEvents,
  }
  return {
    week: isoWeek(from),
    from,
    to,
    daysTracked: days.length,
    identities: out,
    unclaimed,
    trackedMinutes: out.reduce((s, i) => s + i.minutes, 0) + unclaimed.minutes,
  }
}
