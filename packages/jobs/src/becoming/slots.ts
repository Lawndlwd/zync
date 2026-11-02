import { busyMinutes, clockMinutes, freeMinutes } from './day-mode.js'
import { guardApplies, keptByGuards } from './evidence.js'
import type { Busy, Identity, Window } from './types.js'

/** Where an identity fits in a day. Guards aren't placed: they hold their own window. */
export type Slot = {
  identity: string
  start: string
  end: string
  /** The preferred time when the slot had to move ("18:00"). */
  movedFrom?: string
  /** The identity is kept by a guard: the slot is the guard's window. */
  guard?: true
}

const WINDOW_TIMES: Record<Window, [string, string]> = {
  morning: ['06:30', '12:00'],
  midday: ['12:00', '17:00'],
  evening: ['17:00', '21:30'],
}
const ANY_TIME: [string, string] = ['07:00', '21:30']
/** How far after its preferred time a fixed-time identity may slide. */
const SLIDE = 4 * 60
/** Length of the 2-minute version on the calendar. */
export const SMALL_MINUTES = 10
const STEP = 5

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const roundUp = (m: number) => Math.ceil(m / STEP) * STEP

/** Fixed times ("18:00") are placed before windows. */
const fixed = (i: Identity) => (i.when !== undefined && /^\d/.test(i.when) ? 0 : 1)

/** Minutes the identity takes today: its 2-minute version on a heavy day. */
export const slotMinutes = (identity: Identity, heavy: boolean) =>
  heavy && identity.small ? Math.min(SMALL_MINUTES, identity.minutes) : identity.minutes

/**
 * Place each identity in the first free gap of its window, around the day's meetings, other
 * identities and every guard. Fixed times ("18:00") go first and may slide later.
 */
export function placeSlots(identities: Identity[], busy: Busy[], date: string, heavy: boolean): Slot[] {
  const out: Slot[] = []
  const taken: Busy[] = [...busy]
  for (const i of identities)
    for (const g of i.guards.filter((x) => guardApplies(x, date))) {
      const end = g.to === '24:00' ? '23:59' : g.to
      taken.push({ title: g.label, start: `${date}T${g.from}`, end: `${date}T${end}` })
      if (keptByGuards(i))
        out.push({ identity: i.file, start: `${date}T${g.from}`, end: `${date}T${end}`, guard: true })
    }
  for (const i of identities.filter((x) => !keptByGuards(x)).toSorted((a, b) => fixed(a) - fixed(b))) {
    const length = slotMinutes(i, heavy)
    const when = i.when ?? ''
    const [from, to] =
      when === 'morning' || when === 'midday' || when === 'evening'
        ? WINDOW_TIMES[when].map(clockMinutes)
        : /^\d/.test(when)
          ? [clockMinutes(when), Math.min(24 * 60 - 1, clockMinutes(when) + SLIDE)]
          : ANY_TIME.map(clockMinutes)
    if (from === undefined || to === undefined) continue
    const gap = freeMinutes(busyMinutes(taken, date, from, to), from, to)
      .map(([s, e]): [number, number] => [roundUp(s), e])
      .find(([s, e]) => e - s >= length)
    if (!gap) continue
    const start = `${date}T${hhmm(gap[0])}`
    const slot: Slot = { identity: i.file, start, end: `${date}T${hhmm(gap[0] + length)}` }
    if (/^\d/.test(when) && gap[0] !== from) slot.movedFrom = when
    out.push(slot)
    taken.push({ title: i.statement, start: slot.start, end: slot.end })
  }
  return out.toSorted((a, b) => a.start.localeCompare(b.start))
}
