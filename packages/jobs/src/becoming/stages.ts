import { addDays, daysApart, mondayOf } from '../helpers/dates.js'
import { keptByGuards } from './evidence.js'
import type { DayVote, Identity, Stage } from './types.js'
import { voteKey } from './votes.js'

// An identity moves Experiment → Trying → Sticking → Part of me on evidence, never on a date alone.
// Zync only suggests the move; the user accepts or dismisses it.

export const EXPERIMENT_DAYS = 28
/** Consecutive steady weeks each stage needs before the next one is suggested. */
const WEEKS_NEEDED: Record<Exclude<Stage, 'experiment' | 'part'>, number> = { trying: 4, sticking: 3 }
/** An experiment ends with at least this many votes in its 28 days to be worth trying. */
const EXPERIMENT_VOTES = 8

export type StageProgress = {
  stage: Stage
  /** Experiment: the day it's on (1…28). */
  day?: number
  /** Steady weeks in a row so far, and how many the next stage needs. */
  weeks: number
  weeksNeeded: number
  /** Votes a week needs to count as steady (5 for identities kept by guards). */
  perWeek: number
  suggest?: Stage
}

const NEXT: Record<Stage, Stage | undefined> = {
  experiment: 'trying',
  trying: 'sticking',
  sticking: 'part',
  part: undefined,
}

function votesBetween(votes: Map<string, DayVote>, identity: string, from: string, to: string): number {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) if (votes.has(voteKey(d, identity))) n++
  return n
}

/**
 * Steady weeks in a row, newest first, since the stage began. The current week counts once it is
 * already steady; otherwise counting starts from last week.
 */
export function steadyWeeks(votes: Map<string, DayVote>, identity: Identity, date: string, perWeek: number): number {
  const since = identity.stageSince || identity.since
  let monday = mondayOf(date)
  if (votesBetween(votes, identity.file, monday, date) < perWeek) monday = addDays(monday, -7)
  let n = 0
  while (addDays(monday, 6) >= since) {
    if (votesBetween(votes, identity.file, monday, addDays(monday, 6)) < perWeek) break
    n++
    monday = addDays(monday, -7)
  }
  return n
}

export function stageProgress(identity: Identity, votes: Map<string, DayVote>, date: string): StageProgress {
  const perWeek = keptByGuards(identity) ? 5 : 3
  const quiet = identity.quietUntil !== undefined && identity.quietUntil > date
  const base = { stage: identity.stage, perWeek }
  switch (identity.stage) {
    case 'experiment': {
      const since = identity.stageSince || identity.since || date
      const day = Math.min(EXPERIMENT_DAYS, daysApart(since, date) + 1)
      const ready =
        day >= EXPERIMENT_DAYS &&
        votesBetween(votes, identity.file, addDays(date, -(EXPERIMENT_DAYS - 1)), date) >= EXPERIMENT_VOTES
      return { ...base, day, weeks: 0, weeksNeeded: 0, ...(ready && !quiet ? { suggest: 'trying' } : {}) }
    }
    case 'trying':
    case 'sticking': {
      const weeksNeeded = WEEKS_NEEDED[identity.stage]
      const weeks = steadyWeeks(votes, identity, date, perWeek)
      const next = NEXT[identity.stage]
      return { ...base, weeks, weeksNeeded, ...(weeks >= weeksNeeded && next && !quiet ? { suggest: next } : {}) }
    }
    case 'part':
      return { ...base, weeks: 0, weeksNeeded: 0 }
  }
}
