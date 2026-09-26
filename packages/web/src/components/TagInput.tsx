import { useCallback, useRef, useState } from 'react'
import { IconFile, IconFolder } from '../icons'
import { Popover } from './Popover'

/**
 * Chips with an inline "+ add" (labels on cards, context files for AI tasks). Enter or comma adds,
 * Backspace on an empty field removes the last chip, suggestions filter as you type.
 */
export function TagInput({
  values,
  onChange,
  variant = 'label',
  suggestions = [],
  addLabel = '+ add',
  placeholder = 'Type and press Enter',
  ariaLabel,
}: {
  values: string[]
  onChange: (v: string[]) => void
  variant?: 'label' | 'tag'
  suggestions?: string[]
  addLabel?: string
  placeholder?: string
  ariaLabel: string
}) {
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const stop = useCallback(() => {
    setAdding(false)
    setQ('')
  }, [])
  const matches = suggestions
    .filter((s) => !values.includes(s) && s.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 8)

  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, '')
    if (v && !values.includes(v)) onChange([...values, v])
    setQ('')
    setHi(0)
  }
  const chip = variant === 'label' ? 'label' : 'tag chip-tag'

  return (
    <div className="row g6 wrap" role="group" aria-label={ariaLabel}>
      {values.map((v) => (
        <span key={v} className={`${chip} removable`}>
          {variant === 'tag' && (v.endsWith('/') ? <IconFolder size={11} /> : <IconFile size={11} />)}
          {v}
          <button
            type="button"
            className="x"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <>
          <input
            ref={input}
            className="input monoin chip-input"
            autoFocus
            value={q}
            placeholder={placeholder}
            aria-label={`Add to ${ariaLabel}`}
            onChange={(e) => {
              const v = e.target.value
              if (v.endsWith(',')) add(v)
              else {
                setQ(v)
                setHi(0)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(matches[hi] && q ? matches[hi] : q)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHi((h) => Math.min(matches.length - 1, h + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHi((h) => Math.max(0, h - 1))
              } else if (e.key === 'Backspace' && !q && values.length) onChange(values.slice(0, -1))
              else if (e.key === 'Escape') {
                e.stopPropagation()
                stop()
              }
            }}
            onBlur={() => {
              // Let a suggestion click land first.
              window.setTimeout(() => {
                if (document.activeElement !== input.current) {
                  if (q.trim()) add(q)
                  stop()
                }
              }, 120)
            }}
          />
          <Popover
            anchor={input}
            open={matches.length > 0}
            onClose={() => {}}
            className="menu"
            style={{ minWidth: 240 }}
          >
            {matches.map((m, i) => (
              <button
                key={m}
                type="button"
                className={`mi${i === hi ? ' is-hover' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setHi(i)}
                onClick={() => {
                  add(m)
                  input.current?.focus()
                }}
              >
                {m.endsWith('/') ? <IconFolder size={13} /> : variant === 'tag' ? <IconFile size={13} /> : null}
                <span className="trunc">{m}</span>
              </button>
            ))}
          </Popover>
        </>
      ) : (
        <button
          type="button"
          className={variant === 'label' ? 'label alt add' : 'tag add'}
          onClick={() => setAdding(true)}
        >
          {addLabel}
        </button>
      )}
    </div>
  )
}
