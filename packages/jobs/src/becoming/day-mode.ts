import { asUtc } from '../helpers/dates.js'
import { durationLabel } from './format.js'
import type { Busy } from './types.js'

export type DayMode = { mode: 'heavy' | 'open'; meetings: number; longestGap: number; reason: string }

/** The working day that gaps are measured in. */
export const DAY_START = '07:00'
export const DAY_END = '19:00'
const HEAVY_MEETINGS = 5
const HEAVY_GAP = 45

const minutesOf = (stamp: string) => {
  const t = stamp.slice(11, 16)
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
}

/** Busy intervals of a day clipped to [from, to] minutes, merged, sorted. */
export function busyMinutes(busy: Busy[], date: string, from: number, to: number): Array<[number, number]> {
  const spans = busy
    .filter((b) => b.start.length > 10 && b.start.startsWith(date))
    .map((b): [number, number] => {
      const end = b.end.startsWith(date) ? minutesOf(b.end) : 24 * 60
      return [Math.max(from, minutesOf(b.start)), Math.min(to, end)]
    })
    .filter(([s, e]) => e > s)
    .toSorted((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [s, e] of spans) {
    const last = merged.at(-1)
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  return merged
}

/** Free intervals between `from` and `to` minutes, given merged busy spans. */
export function freeMinutes(busy: Array<[number, number]>, from: number, to: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let at = from
  for (const [s, e] of busy) {
    if (s > at) out.push([at, Math.min(s, to)])
    at = Math.max(at, e)
    if (at >= to) break
  }
  if (at < to) out.push([at, to])
  return out.filter(([s, e]) => e > s)
}

export const clockMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/**
 * Heavy when the day holds 5+ timed meetings, or no gap between them (07:00–19:00) reaches 45 min
 * while there is at least one: then every identity asks only for its 2-minute version.
 */
export function dayMode(busy: Busy[], date: string): DayMode {
  const from = clockMinutes(DAY_START)
  const to = clockMinutes(DAY_END)
  const meetings = busy.filter(
    (b) => b.start.length > 10 && b.start.startsWith(date) && asUtc(b.end) > asUtc(b.start),
  ).length
  const gaps = freeMinutes(busyMinutes(busy, date, from, to), from, to)
  const longestGap = Math.max(0, ...gaps.map(([s, e]) => e - s))
  const heavy = meetings >= HEAVY_MEETINGS || (meetings > 0 && longestGap < HEAVY_GAP)
  const reason =
    meetings === 0
      ? 'No meetings'
      : `${meetings} meeting${meetings === 1 ? '' : 's'}, longest gap ${durationLabel(longestGap)}`
  return { mode: heavy ? 'heavy' : 'open', meetings, longestGap, reason }
}
