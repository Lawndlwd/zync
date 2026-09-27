import { useCallback, useRef, useState } from 'react'

import { formatDateValue, parseDateValue, ymd } from '../helpers/dates'
import { CalendarIcon } from '../icons'
import { MonthCalendar } from './MonthCalendar'
import { Popover } from './Popover'

// Calendar popover replacing the browser's date/datetime inputs. Values stay in the card format:
// "2026-10-02" (date) or "2026-10-02T09:00" (local date-time).

export function DatePicker({
  value,
  onChange,
  withTime,
  optionalTime,
  placeholder = 'No date',
  compact,
  ariaLabel = 'Date',
  className = '',
  invalid,
}: {
  value: string | undefined
  onChange: (v: string | null) => void
  withTime?: boolean
  /** A date that may also carry a time: offers [+ Time] / [All day] and keeps whichever the value has. */
  optionalTime?: boolean
  placeholder?: string
  compact?: boolean
  ariaLabel?: string
  className?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const { date, time } = parseDateValue(value)
  const label = formatDateValue(value)
  const timed = withTime || (optionalTime && !!value?.includes('T'))

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
        <MonthCalendar
          date={date}
          time={time}
          withTime={timed}
          optionalTime={optionalTime && !withTime}
          onAllDay={() => onChange(ymd(date ?? new Date()))}
          onPick={(d, t, setTime) => {
            const useTime = timed || setTime
            onChange(useTime ? `${ymd(d)}T${t}` : ymd(d))
            if (!useTime) {
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
