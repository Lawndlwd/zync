import path from 'node:path'

import { WEEKDAYS } from '../calendar/types.js'
import { addDays, asUtc } from '../helpers/dates.js'
import { tonnage } from '../training/stats.js'
import { sessions } from './activity.js'
import { durationLabel } from './format.js'
import type { Activity, Busy, Evidence, Guard, Identity, Signal, WorkoutDone } from './types.js'

/**
 * What a day looked like, as far as evidence goes. `now` is a local "YYYY-MM-DDTHH:MM"; `workouts`
 * are the finished workouts (Training/Log) around that day.
 */
export type DayFacts = { date: string; activity: Activity[]; events: Busy[]; now: string; workouts?: WorkoutDone[] }

/** Minutes of a workout that make a full vote, unless the signal says otherwise. */
export const WORKOUT_MIN_MINUTES = 20

const weekdayOf = (date: string) => WEEKDAYS[asUtc(date).getUTCDay()] ?? 'sun'

/** "Writing/", "Writing" and "./Writing/" all mean everything inside Writing. */
function underFolder(rel: string, folder: string): boolean {
  const f = folder.replace(/^\.\//, '').replace(/\/+$/, '')
  return f === '' || rel === f || rel.startsWith(`${f}/`)
}

export const guardApplies = (g: Guard, date: string) => !g.days || g.days.includes(weekdayOf(date))

/** A guard's window on a day, as local stamps; "24:00" ends at the next midnight. */
export function guardWindow(g: Guard, date: string): { start: string; end: string } {
  return { start: `${date}T${g.from}`, end: g.to === '24:00' ? `${addDays(date, 1)}T00:00` : `${date}T${g.to}` }
}

function fromFiles(identity: Identity, signals: Signal[], facts: DayFacts): Evidence | null {
  const folders = signals.flatMap((s) => ('files' in s ? [s.files] : []))
  if (folders.length === 0) return null
  const edits = facts.activity.filter((a) => a.kind === 'edit' && folders.some((f) => underFolder(a.path, f)))
  const found = sessions(edits)
  if (found.length === 0) return null
  const minutes = found.reduce((sum, s) => sum + s.minutes, 0)
  const longest = found.toSorted((a, b) => b.minutes - a.minutes)[0]
  const file = longest?.files[0] ?? ''
  return {
    kind: minutes >= identity.minutes ? 'full' : 'small',
    note: `${durationLabel(minutes)} in ${path.posix.basename(file)}`,
  }
}

function fromEvents(signals: Signal[], facts: DayFacts): Evidence | null {
  const words = signals.flatMap((s) => ('event' in s ? [s.event.toLowerCase()] : []))
  if (words.length === 0) return null
  const hit = facts.events.find(
    (e) => e.end <= facts.now && e.start.startsWith(facts.date) && words.some((w) => e.title.toLowerCase().includes(w)),
  )
  return hit ? { kind: 'full', note: `“${hit.title}” at ${hit.start.slice(11, 16)}` } : null
}

function fromCards(signals: Signal[], facts: DayFacts): Evidence | null {
  const wanted = signals.flatMap((s) => ('card' in s ? [s.card] : []))
  if (wanted.length === 0) return null
  const matches = facts.activity.filter(
    (a) =>
      (a.kind === 'card-done' || a.kind === 'card-moved') &&
      wanted.some(
        (w) =>
          (w.board === undefined || underFolder(a.path, w.board)) &&
          (w.label === undefined || (a.labels ?? []).includes(w.label)),
      ),
  )
  const done = matches.find((a) => a.kind === 'card-done')
  const hit = done ?? matches[0]
  if (!hit) return null
  const title = path.posix.basename(hit.path, '.md')
  return done ? { kind: 'full', note: `card “${title}” → done` } : { kind: 'small', note: `card “${title}” moved` }
}

/** "Push Day · 48 min · 6.2 t". */
export const workoutNote = (w: WorkoutDone) =>
  [w.name, durationLabel(w.minutes), ...(w.volumeKg > 0 ? [tonnage(w.volumeKg)] : [])].join(' · ')

function fromWorkouts(signals: Signal[], facts: DayFacts): Evidence | null {
  const wanted = signals.flatMap((s) => ('workout' in s ? [s.workout.minMinutes ?? WORKOUT_MIN_MINUTES] : []))
  if (wanted.length === 0) return null
  const longest = (facts.workouts ?? [])
    .filter((w) => w.date === facts.date)
    .toSorted((a, b) => b.minutes - a.minutes)[0]
  if (!longest) return null
  return { kind: longest.minutes >= Math.min(...wanted) ? 'full' : 'small', note: workoutNote(longest) }
}

/** An identity kept by a guard: a vote once the window is over with nothing done inside it. */
function fromGuards(identity: Identity, facts: DayFacts): Evidence | null {
  const guards = identity.guards.filter((g) => guardApplies(g, facts.date))
  if (guards.length === 0) return null
  for (const g of guards) {
    const w = guardWindow(g, facts.date)
    if (facts.now < w.end) return null
    if (facts.activity.some((a) => a.t >= w.start && a.t < w.end)) return null
  }
  return { kind: 'full', note: guards.length === 1 ? `${guards[0]?.label ?? 'guard'} kept` : 'guards kept' }
}

/** An identity with no signals at all, only guards: voted when its guards hold. */
export const keptByGuards = (i: Identity) => i.signals.length === 0 && i.guards.length > 0

/** Only signals that Zync can see; `manual` needs the user. */
const seen = (s: Signal) => !('manual' in s)

/** What Zync saw for an identity on a day, strongest first; null when nothing. */
export function evidenceFor(identity: Identity, facts: DayFacts): Evidence | null {
  const signals = identity.signals.filter(seen)
  const found = [
    fromFiles(identity, signals, facts),
    fromEvents(signals, facts),
    fromCards(signals, facts),
    fromWorkouts(signals, facts),
  ].filter((e): e is Evidence => e !== null)
  if (keptByGuards(identity)) {
    const kept = fromGuards(identity, facts)
    if (kept) found.push(kept)
  }
  return found.find((e) => e.kind === 'full') ?? found[0] ?? null
}

/** Whether the identity is only ever voted by hand. */
export const isManual = (identity: Identity) =>
  identity.signals.length > 0 ? !identity.signals.some(seen) : identity.guards.length === 0
