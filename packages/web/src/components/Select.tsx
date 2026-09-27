import { type CSSProperties, type KeyboardEvent, type ReactNode, useCallback, useRef, useState } from 'react'

import { useScrollActiveIntoView } from '../hooks/useScrollActiveIntoView'
import { IconCheck, IconChevDown } from '../icons'
import { Popover } from './Popover'

export type Option<T extends string> = {
  value: T
  label: ReactNode
  /** Text used for type-ahead and filtering (defaults to the value). */
  text?: string
  icon?: ReactNode
  hint?: ReactNode
}

/**
 * Listbox select in the zync style (`.select` trigger + `.menu`). Keyboard: ↑↓ Home End, Enter/Space
 * to pick, Esc to close, type to jump. Optional search box for long lists.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  compact,
  searchable,
  footer,
  style,
  className = '',
  ariaLabel,
  trigger,
}: {
  value: T | undefined
  options: Array<Option<T>>
  onChange: (v: T) => void
  placeholder?: string
  compact?: boolean
  searchable?: boolean
  /** Extra rows under the options (e.g. "[+] New person"); receives a close callback. */
  footer?: (close: () => void, query: string) => ReactNode
  style?: CSSProperties
  className?: string
  ariaLabel?: string
  /** Replace the default trigger content (the selected option). */
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setQ('')
  }, [])
  const current = options.find((o) => o.value === value)
  const text = (o: Option<T>) => (o.text ?? o.value).toLowerCase()
  const shown = q ? options.filter((o) => text(o).includes(q.toLowerCase())) : options

  /** Opens with the current value highlighted. */
  const show = () => {
    const i = options.findIndex((o) => o.value === value)
    setHi(i < 0 ? 0 : i)
    setOpen(true)
  }
  useScrollActiveIntoView(list, hi, `[data-i="${hi}"]`)

  const pick = (o: Option<T>) => {
    onChange(o.value)
    close()
    btn.current?.focus()
  }

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'ArrowDown') setHi((h) => Math.min(shown.length - 1, h + 1))
    else if (e.key === 'ArrowUp') setHi((h) => Math.max(0, h - 1))
    else if (e.key === 'Home') setHi(0)
    else if (e.key === 'End') setHi(shown.length - 1)
    else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) {
      if (shown[hi]) pick(shown[hi])
    } else if (e.key === 'Tab') close()
    else if (!searchable && e.key.length === 1) {
      const i = shown.findIndex((o) => text(o).startsWith(e.key.toLowerCase()))
      if (i >= 0) setHi(i)
      return
    } else return
    e.preventDefault()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`select${compact ? ' compact' : ''}${open ? ' is-open' : ''} ${className}`}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
      >
        {trigger ?? (
          <span className="row g8 trunc">
            {current?.icon}
            {current ? current.label : <span className="muted">{placeholder}</span>}
          </span>
        )}
        <IconChevDown className="chev" />
      </button>
      <Popover
        anchor={btn}
        open={open}
        onClose={close}
        matchWidth={!searchable}
        role="listbox"
        className="menu select-menu"
      >
        {searchable && (
          <div className="mi search-mi">
            <input
              className="input monoin"
              style={{ height: 30 }}
              autoFocus
              placeholder="Find…"
              aria-label="Filter options"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setHi(0)
              }}
              onKeyDown={onKey}
            />
          </div>
        )}
        <div ref={list} className="col" style={{ gap: 2, overflowY: 'auto', maxHeight: 280 }}>
          {shown.map((o, i) => {
            const on = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                data-i={i}
                role="option"
                aria-selected={on}
                className={`mi${i === hi ? ' is-hover' : ''}${on ? ' on' : ''}`}
                onMouseMove={() => setHi(i)}
                onClick={() => pick(o)}
              >
                {o.icon}
                <span className="grow trunc">{o.label}</span>
                {o.hint && <span className="mono-s muted">{o.hint}</span>}
                {on && <IconCheck size={11} />}
              </button>
            )
          })}
          {!shown.length && (
            <span className="small muted" style={{ padding: '6px 10px' }}>
              No matches
            </span>
          )}
        </div>
        {footer && (
          <>
            <span className="sepline" />
            {footer(close, q)}
          </>
        )}
      </Popover>
    </>
  )
}
