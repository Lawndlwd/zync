import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { IconChevRight } from '../icons'
import { addDays, dayLabel, pad2, startOfWeek } from '../workspaceData'
import { IconButton, TextButton } from './Button'
import { Popover } from './Popover'

// Calendar popover replacing the browser's date/datetime inputs. Values stay in the card format:
// "2026-10-02" (date) or "2026-10-02T09:00" (local date-time).

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const TIMES = ['09:00', '12:00', '15:00', '18:00']

const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

function parse(v: string | undefined): { date: Date | null; time: string } {
  if (!v) return { date: null, time: '09:00' }
  const [d, t] = v.split('T')
  const date = new Date(`${d}T00:00`)
  return { date: Number.isNaN(date.getTime()) ? null : date, time: t?.slice(0, 5) || '09:00' }
}

const sameYmd = (a: Date | null, b: Date) => !!a && ymd(a) === ymd(b)

export function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  )
}

export function formatDateValue(v: string | undefined, withYear = true): string {
  const { date, time } = parse(v)
  if (!date) return ''
  const day = `${dayLabel(date)}${withYear ? ` ${date.getFullYear()}` : ''}`
  return v?.includes('T') ? `${day} · ${time}` : day
}

export function DatePicker({
  value,
  onChange,
  withTime,
  placeholder = 'No date',
  compact,
  ariaLabel = 'Date',
  className = '',
  invalid,
}: {
  value: string | undefined
  onChange: (v: string | null) => void
  withTime?: boolean
  placeholder?: string
  compact?: boolean
  ariaLabel?: string
  className?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const { date, time } = parse(value)
  const label = formatDateValue(value)

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`select${compact ? ' compact' : ''}${open ? ' is-open' : ''}${invalid ? ' err' : ''} ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${label || 'none'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`trunc${label ? '' : ' muted'}`}>{label || placeholder}</span>
        <CalendarIcon />
      </button>
      <Popover anchor={btn} open={open} onClose={close} className="menu datepick" role="dialog">
        <Calendar
          date={date}
          time={time}
          withTime={withTime}
          onPick={(d, t) => {
            onChange(withTime ? `${ymd(d)}T${t}` : ymd(d))
            if (!withTime) {
              close()
              btn.current?.focus()
            }
          }}
          onClear={() => {
            onChange(null)
            close()
          }}
          onDone={() => {
            close()
            btn.current?.focus()
          }}
        />
      </Popover>
    </>
  )
}

function Calendar({
  date,
  time,
  withTime,
  onPick,
  onClear,
  onDone,
}: {
  date: Date | null
  time: string
  withTime?: boolean
  onPick: (d: Date, time: string) => void
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

  useEffect(() => {
    grid.current?.querySelector<HTMLElement>('[data-cursor="1"]')?.focus()
  }, [cursor])

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
    onPick(date ?? cursor, next)
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
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={`${d}${i}`}>{d}</span>
        ))}
      </div>
      <div ref={grid} className="dp-grid" role="grid" onKeyDown={onKey}>
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
              data-cursor={isCursor ? '1' : undefined}
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
      {withTime && (
        <div className="col g6" style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
          <div className="row g6">
            <span className="flabel" style={{ width: 40 }}>
              Time
            </span>
            <input
              key={t}
              className={`input monoin compact${tErr ? ' err' : ''}`}
              style={{ width: 76, height: 30 }}
              defaultValue={t}
              aria-label="Time (HH:MM)"
              aria-invalid={tErr || undefined}
              onBlur={(e) => commitTime(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitTime((e.target as HTMLInputElement).value)}
            />
            {TIMES.map((x) => (
              <button
                key={x}
                type="button"
                className={`pill dp-time${x === t ? ' on' : ''}`}
                onClick={() => commitTime(x)}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row g12" style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
        <TextButton onClick={() => onPick(today, t)}>[Today]</TextButton>
        <TextButton onClick={() => onPick(addDays(today, 1), t)}>[Tomorrow]</TextButton>
        <TextButton onClick={() => onPick(addDays(startOfWeek(today), 7), t)}>[Next Mon]</TextButton>
        <span className="grow" />
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
