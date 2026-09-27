import { z } from 'zod'

// Local wall-clock times are strings without a timezone: "YYYY-MM-DD" (a day) or "YYYY-MM-DDTHH:MM".
// Arithmetic treats them as UTC so DST never shifts them.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
/** A day or a date-time. */
export const WHEN_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/

export function defaultTimezone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export const isDate = (s: string) => DATE_RE.test(s)
export const asUtc = (s: string) => new Date(`${isDate(s) ? `${s}T00:00` : s.slice(0, 16)}:00Z`)

export function addMinutes(stamp: string, minutes: number): string {
  return new Date(asUtc(stamp).getTime() + minutes * 60_000).toISOString().slice(0, 16)
}

export function addDays(date: string, days: number): string {
  return new Date(asUtc(date).getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

export const daysApart = (a: string, b: string) => Math.round((asUtc(b).getTime() - asUtc(a).getTime()) / 86_400_000)

export const mondayOf = (date: string) => addDays(date, -((asUtc(date).getUTCDay() + 6) % 7))

/** A moment as local wall-clock YYYY-MM-DDTHH:MM in `timeZone` (default: the scheduler's). */
export function localStamp(date = new Date(), timeZone = defaultTimezone()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/**
 * A frontmatter wall-clock field. YAML turns unquoted dates into Date objects: normalise them back
 * to "YYYY-MM-DD" (midnight) or "YYYY-MM-DDTHH:MM".
 */
export const wallClockField = (re: RegExp, message: string) =>
  z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10) : v),
    z.string().regex(re, { message }),
  )

/** A frontmatter day field ("YYYY-MM-DD"), normalised like `wallClockField`. */
export const dayField = (message: string) =>
  z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), z.string().regex(DATE_RE, { message }))
