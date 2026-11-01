import path from 'node:path'

import { listBoards, listCards } from '../boards/index.js'
import { calendarRange } from '../calendar/range.js'
import { addDays, localStamp } from '../helpers/dates.js'
import { readActivity } from './activity.js'
import { type DayMode, dayMode } from './day-mode.js'
import { type DayFacts, evidenceFor, isManual } from './evidence.js'
import { placeSlots, type Slot } from './slots.js'
import { type StageProgress, stageProgress } from './stages.js'
import { listIdentities } from './store.js'
import type { Activity, Busy, DayVote, Evidence, Identity } from './types.js'
import { readVotes, standingVotes, type StripCell, strip, voteKey } from './votes.js'
import { workoutsDone } from './workouts.js'

export type TodayRow = {
  identity: Identity
  /** What today asks for: the 2-minute version on a heavy day. */
  target: 'full' | 'small'
  slot?: Slot
  /** The day's vote: cast by the user, or what Zync saw so far. */
  vote?: DayVote
  /** What Zync saw today, even when the user voted by hand. */
  evidence?: Evidence
  missedYesterday: boolean
  /** Zync can't see it happen: the user votes. */
  manual: boolean
  progress: StageProgress
  strip: StripCell[]
}

export type OneCard = { title: string; board: string; file: string; identity: string }

export type BecomingToday = {
  date: string
  day: DayMode
  rows: TodayRow[]
  oneCard?: OneCard
}

/** Yesterday's miss first (never miss twice), then the day in slot order. */
const order = (r: TodayRow) => (r.missedYesterday && !r.vote ? '0' : `1${r.slot?.start ?? '~'}`)

/** Zync's own timed events, as busy time. */
export async function zyncBusy(wsPath: string, from: string, to: string): Promise<Busy[]> {
  const items = await calendarRange(wsPath, from, to)
  return items
    .filter((i) => i.kind === 'event' && !i.allDay)
    .map((i): Busy => {
      const busy: Busy = { title: i.title, start: i.start, end: i.end }
      if (i.recurring) busy.recurring = true
      return busy
    })
}

/** The soonest open card that votes for one of the identities (by label or board). */
export async function findOneCard(wsPath: string, identities: Identity[]): Promise<OneCard | undefined> {
  const wanted = identities.flatMap((i) =>
    i.signals.flatMap((s) => ('card' in s ? [{ identity: i.file, ...s.card }] : [])),
  )
  if (wanted.length === 0) return undefined
  const found: Array<OneCard & { due: string }> = []
  for (const board of await listBoards(wsPath)) {
    const done = board.columns.at(-1)?.id
    for (const c of await listCards(wsPath, board.path)) {
      if (c.status === done) continue
      const hit = wanted.find(
        (w) =>
          (w.board === undefined || path.posix.normalize(w.board).replace(/\/$/, '') === board.path) &&
          (w.label === undefined || c.labels.includes(w.label)),
      )
      if (hit)
        found.push({ title: c.title, board: board.path, file: c.file, identity: hit.identity, due: c.due ?? '~' })
    }
  }
  const first = found.toSorted((a, b) => a.due.localeCompare(b.due))[0]
  return first ? { title: first.title, board: first.board, file: first.file, identity: first.identity } : undefined
}

/**
 * Everything the Becoming tile shows for a day: heavy or open, each identity's target, slot,
 * vote and evidence, never-miss-twice. `external` is the calendar from connected accounts
 * (yesterday → tomorrow); `now` a local "YYYY-MM-DDTHH:MM".
 */
export async function becomingToday(
  wsPath: string,
  date: string,
  external: Busy[] = [],
  now = localStamp(),
): Promise<BecomingToday> {
  const yesterday = addDays(date, -1)
  const [identities, votes, activity, own, workouts] = await Promise.all([
    listIdentities(wsPath),
    readVotes(wsPath),
    readActivity(wsPath, yesterday, addDays(date, 1)),
    zyncBusy(wsPath, yesterday, addDays(date, 1)),
    workoutsDone(wsPath, yesterday, addDays(date, 1)),
  ])
  const events = [...own, ...external]
  const standing = standingVotes(votes)
  const day = dayMode(events, date)
  const heavy = day.mode === 'heavy'
  const slots = placeSlots(identities, events, date, heavy)
  const facts = (d: string): DayFacts => ({
    date: d,
    activity: activity.filter((a: Activity) => a.t.startsWith(d)),
    events,
    now,
    workouts,
  })
  const todayFacts = facts(date)
  const yesterdayFacts = facts(yesterday)

  const rows = identities.map((identity): TodayRow => {
    const evidence = evidenceFor(identity, todayFacts) ?? undefined
    const cast = standing.get(voteKey(date, identity.file))
    const vote = cast ?? (evidence ? { kind: evidence.kind, source: 'auto' as const, note: evidence.note } : undefined)
    const votedYesterday =
      standing.has(voteKey(yesterday, identity.file)) || evidenceFor(identity, yesterdayFacts) !== null
    const slot = slots.find((s) => s.identity === identity.file)
    const withToday = new Map(standing)
    if (vote) withToday.set(voteKey(date, identity.file), vote)
    return {
      identity,
      target: heavy && identity.small ? 'small' : 'full',
      ...(slot ? { slot } : {}),
      ...(vote ? { vote } : {}),
      ...(evidence ? { evidence } : {}),
      missedYesterday: identity.since !== '' && identity.since < date && !votedYesterday,
      manual: isManual(identity),
      progress: stageProgress(identity, withToday, date),
      strip: strip(withToday, identity, date),
    }
  })
  const oneCard = await findOneCard(wsPath, identities)
  return {
    date,
    day,
    rows: rows.toSorted((a, b) => order(a).localeCompare(order(b))),
    ...(oneCard ? { oneCard } : {}),
  }
}
