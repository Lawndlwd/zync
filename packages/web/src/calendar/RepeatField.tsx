import type { Repeat, Weekday } from '../api'
import { PillToggle } from '../components/Controls'
import { DatePicker, formatDateValue } from '../components/DatePicker'
import { Select } from '../components/Select'

type Every = Repeat['every']

const WEEK: { id: Weekday; short: string; long: string }[] = [
  { id: 'mon', short: 'M', long: 'Monday' },
  { id: 'tue', short: 'T', long: 'Tuesday' },
  { id: 'wed', short: 'W', long: 'Wednesday' },
  { id: 'thu', short: 'T', long: 'Thursday' },
  { id: 'fri', short: 'F', long: 'Friday' },
  { id: 'sat', short: 'S', long: 'Saturday' },
  { id: 'sun', short: 'S', long: 'Sunday' },
]
const UNIT: Record<Every, string> = { day: 'day', week: 'week', month: 'month', year: 'year' }
const SUNDAY_FIRST: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** The weekday of a "YYYY-MM-DD[THH:MM]" start. */
export const weekdayOf = (start: string): Weekday => SUNDAY_FIRST[new Date(`${start.slice(0, 10)}T12:00`).getDay()]

/** "Every Mon, Fri at 05:00 · until 31 Dec" */
export function describeRepeat(r: Repeat, start: string): string {
  const n = r.interval ?? 1
  const every = n > 1 ? `Every ${n} ${UNIT[r.every]}s` : `Every ${UNIT[r.every]}`
  const days =
    r.every === 'week'
      ? ` on ${(r.days?.length ? r.days : [weekdayOf(start)])
          .map((d) => WEEK.find((w) => w.id === d)?.long.slice(0, 3))
          .join(', ')}`
      : r.every === 'month'
        ? ` on day ${Number(start.slice(8, 10))}`
        : ''
  const at = start.length > 10 ? ` at ${start.slice(11, 16)}` : ''
  const until = r.until ? ` · until ${formatDateValue(r.until, false)}` : ''
  const skipped = r.except?.length ? ` · ${r.except.length} skipped` : ''
  return `${every}${days}${at}${until}${skipped}`
}

/**
 * The `repeat` rule of an event, as property rows: how often, which weekdays, until when.
 * `null` = a one-off event. Renders inside a `.kv` grid (label, value pairs).
 */
export function RepeatField({
  value,
  start,
  onChange,
}: {
  value: Repeat | undefined
  start: string
  onChange: (r: Repeat | null) => void
}) {
  const set = (patch: Partial<Repeat>) => value && onChange({ ...value, ...patch })
  const days = value?.days?.length ? value.days : [weekdayOf(start)]
  return (
    <>
      <span className="k">repeat</span>
      <div className="row g6">
        <div className="grow">
          <Select<Every | 'none'>
            compact
            ariaLabel="repeat"
            value={value?.every ?? 'none'}
            options={[
              { value: 'none', label: 'Does not repeat', text: 'Does not repeat' },
              { value: 'day', label: 'Daily', text: 'Daily' },
              { value: 'week', label: 'Weekly', text: 'Weekly' },
              { value: 'month', label: 'Monthly', text: 'Monthly', hint: `Day ${Number(start.slice(8, 10))}` },
              { value: 'year', label: 'Yearly', text: 'Yearly' },
            ]}
            onChange={(every) => {
              if (every === 'none') return onChange(null)
              const { days: _, ...rest } = value ?? {}
              onChange({ ...rest, every, ...(every === 'week' ? { days: [weekdayOf(start)] } : {}) })
            }}
          />
        </div>
        {value && (
          <div style={{ width: 118 }}>
            <Select
              compact
              ariaLabel="interval"
              value={String(value.interval ?? 1)}
              options={Array.from({ length: 12 }, (_, i) => {
                const n = i + 1
                const text = n === 1 ? `every ${UNIT[value.every]}` : `every ${n} ${UNIT[value.every]}s`
                return { value: String(n), label: text, text }
              })}
              onChange={(n) => set({ interval: Number(n) > 1 ? Number(n) : undefined })}
            />
          </div>
        )}
      </div>
      {value?.every === 'week' && (
        <>
          <span className="k">on</span>
          <div className="row g4 wrap" role="group" aria-label="Repeat on">
            {WEEK.map((d) => (
              <span key={d.id} title={d.long} className="repeat-day">
                <PillToggle
                  pressed={days.includes(d.id)}
                  onChange={(on) => {
                    const next = on ? [...days, d.id] : days.filter((x) => x !== d.id)
                    // At least one day: the last one can't be switched off.
                    if (next.length) set({ days: next })
                  }}
                >
                  <span aria-hidden="true">{d.short}</span>
                  <span className="sr-only">{d.long}</span>
                </PillToggle>
              </span>
            ))}
          </div>
        </>
      )}
      {value && (
        <>
          <span className="k">until</span>
          <DatePicker
            compact
            ariaLabel="repeat until"
            placeholder="Forever"
            value={value.until}
            invalid={!!value.until && value.until < start.slice(0, 10)}
            onChange={(until) => set({ until: until ?? undefined })}
          />
        </>
      )}
    </>
  )
}
