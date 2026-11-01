import type { RoutineExercise, TargetSet } from './types.js'

// Double progression: work inside a rep range; once every set reaches the top of it, add weight and
// start again from the bottom.

export type RepRange = { min: number; max: number }

/** The rep range of a scheme: "3×8-12 · 90s" → 8–12, "5x5" → 5–5, "8-10 reps" → 8–10; null when none. */
export function repRange(scheme: string): RepRange | null {
  const sets = /\d+\s*[x×*]\s*(\d+)(?:\s*[-–]\s*(\d+))?/i.exec(scheme)
  const m = sets ?? /(\d+)\s*[-–]\s*(\d+)/.exec(scheme)
  if (!m?.[1]) return null
  const min = Number(m[1])
  const max = Number(m[2] ?? m[1])
  return min > 0 && max >= min ? { min, max } : null
}

/** The next weight after a range is topped: +2.5 kg from 20 kg up, +1 kg for lighter lifts. */
export const increment = (kg: number) => (kg >= 20 ? 2.5 : 1)

const at = <T>(list: readonly T[], i: number): T | undefined => list[i] ?? list.at(-1)

/**
 * What to aim for today on a routine exercise, given the sets that counted last time (done, not
 * warm-ups). Topped the range in every set → heavier, back to the bottom of the range; otherwise
 * repeat last time; never done → the routine's targets. As many sets as the routine plans (or as
 * last time when it plans none).
 */
export function suggestSets(target: RoutineExercise, last: readonly TargetSet[]): TargetSet[] {
  const count = target.sets.length > 0 ? target.sets.length : Math.max(last.length, 1)
  if (last.length === 0) {
    return Array.from({ length: count }, (_, i) => ({ ...at(target.sets, i) }))
  }
  const range = repRange(target.scheme)
  if (range && last.every((s) => (s.reps ?? 0) >= range.max && (s.kg ?? 0) > 0)) {
    const heaviest = Math.max(...last.map((s) => s.kg ?? 0))
    const step = increment(heaviest)
    return Array.from({ length: count }, (_, i) => ({ kg: (at(last, i)?.kg ?? heaviest) + step, reps: range.min }))
  }
  return Array.from({ length: count }, (_, i) => {
    const s = at(last, i)
    return {
      ...(s?.kg === undefined ? {} : { kg: s.kg }),
      ...(s?.reps === undefined ? {} : { reps: s.reps }),
    }
  })
}
