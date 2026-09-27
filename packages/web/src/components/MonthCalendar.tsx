import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { addDays, dayLabel, MONTHS, pad2, sameYmd, startOfWeek, WEEKDAYS_MONDAY_FIRST, ymd } from '../helpers/dates'
import { IconChevRight } from '../icons'
import { IconButton } from './IconButton'
import { TextButton } from './TextButton'

const TIMES = ['09:00', '12:00', '15:00', '18:00']

export function MonthCalendar({
  date,
  time,
  withTime,
  optionalTime,
  onAllDay,
  onPick,
  onClear,
  onDone,
}: {
  date: Date | null
  time: string
  withTime?: boolean
  /** Show the time row even without a time: typing or picking one adds it, [All day] removes it. */
  optionalTime?: boolean
  onAllDay: () => void
  /** `setTime`: the user chose a time, so the value gets one. */
  onPick: (d: Date, time: string, setTime?: boolean) => void
  onClear: () => void
  onDone: () => void
}) {
  const today = new Date()
  const [cursor, setCursor] = useState(() => date ?? today)
  const [t, setT] = useState(time)
  const [tErr, setTErr] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))

  // Keyboard focus follows the cursor day.
  const cursorDay = ymd(cursor)
  useEffect(() => {
    grid.current?.querySelector<HTMLElement>(`[data-day="${cursorDay}"]`)?.focus()
  }, [cursorDay])

  const month = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, Math.min(c.getDate(), 28)))
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step) {
      e.preventDefault()
      setCursor((c) => addDays(c, step))
    } else if (e.key === 'PageUp') month(-1)
    else if (e.key === 'PageDown') month(1)
  }
  const commitTime = (v: string) => {
    if (optionalTime && !v.trim()) {
      setTErr(false)
      if (withTime) onAllDay()
      return
    }
    const m = v.trim().match(/^(\d{1,2})[:h.]?(\d{2})?$/)
    const h = m ? Number(m[1]) : Number.NaN
    const min = m?.[2] ? Number(m[2]) : 0
    if (!m || h > 23 || min > 59) {
      setTErr(true)
      return
    }
    const next = `${pad2(h)}:${pad2(min)}`
    setT(next)
    setTErr(false)
    onPick(date ?? cursor, next, true)
  }

  return (
    <div className="col g10" style={{ padding: 6, width: 272 }}>
      <div className="row between">
        <span className="mono">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <span className="row g4">
          <IconButton small label="Previous month" onClick={() => month(-1)}>
            <IconChevRight style={{ transform: 'rotate(180deg)' }} />
          </IconButton>
          <IconButton small label="Next month" onClick={() => month(1)}>
            <IconChevRight />
          </IconButton>
        </span>
      </div>
      <div className="dp-grid mono-s muted" aria-hidden="true">
        {WEEKDAYS_MONDAY_FIRST.map((d) => (
          <span key={d}>{d[0]}</span>
        ))}
      </div>
      <div ref={grid} className="dp-grid" role="grid" tabIndex={-1} onKeyDown={onKey}>
        {days.map((d) => {
          const out = d.getMonth() !== cursor.getMonth()
          const sel = sameYmd(date, d)
          const isCursor = sameYmd(cursor, d)
          return (
            <button
              key={ymd(d)}
              type="button"
              role="gridcell"
              aria-selected={sel}
              aria-label={`${dayLabel(d)} ${d.getFullYear()}`}
              tabIndex={isCursor ? 0 : -1}
              data-day={isCursor ? cursorDay : undefined}
              className={`dp-day${out ? ' out' : ''}${sel ? ' sel' : ''}${sameYmd(today, d) ? ' today' : ''}`}
              onClick={() => {
                setCursor(d)
                onPick(d, t)
              }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      {(withTime || optionalTime) && (
        <div className="col g6" style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
          <div className="row g6">
            <span className="flabel" style={{ width: 40 }}>
              Time
            </span>
            <input
              key={`${t}:${withTime}`}
              className={`input monoin compact${tErr ? ' err' : ''}`}
              style={{ width: 76, height: 30 }}
              defaultValue={withTime ? t : ''}
              placeholder={withTime ? undefined : 'all day'}
              aria-label="Time (HH:MM)"
              aria-invalid={tErr || undefined}
              onBlur={(e) => commitTime(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitTime(e.currentTarget.value)}
            />
          </div>
          <div className="row g6 wrap">
            {TIMES.map((x) => (
              <button
                key={x}
                type="button"
                className={`pill dp-time${withTime && x === t ? ' on' : ''}`}
                onClick={() => commitTime(x)}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row wrap" style={{ borderTop: '1px dashed var(--line)', paddingTop: 10, gap: '6px 12px' }}>
        <TextButton onClick={() => onPick(today, t)}>[Today]</TextButton>
        <TextButton onClick={() => onPick(addDays(today, 1), t)}>[Tomorrow]</TextButton>
        <TextButton onClick={() => onPick(addDays(startOfWeek(today), 7), t)}>[Next Mon]</TextButton>
        <span className="grow" />
        {optionalTime && withTime && <TextButton onClick={onAllDay}>[All day]</TextButton>}
        {date && (
          <TextButton className="muted" onClick={onClear}>
            [Clear]
          </TextButton>
        )}
        {withTime && <TextButton onClick={onDone}>[Done]</TextButton>}
      </div>
    </div>
  )
}
