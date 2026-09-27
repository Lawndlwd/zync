import { useCallback, useRef, useState } from 'react'

import { useDismiss } from '../hooks/useDismiss'
import { IconChevDown } from '../icons'
import type { Range } from '../types/overview'

export function RangeButton({ range, setRange }: { range: Range; setRange: (r: Range) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const label = range === 'today' ? 'Today' : 'This week'
  return (
    <div ref={ref} style={{ marginLeft: 'auto', position: 'relative' }}>
      <button
        className="btn btn-ghost"
        aria-label={`Range: ${label.toLowerCase()}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <IconChevDown />
      </button>
      {open && (
        <div className="menu pop" style={{ top: 40, right: 0, minWidth: 160 }} role="menu">
          {(['today', 'week'] as const).map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={range === r}
              className={`mi${range === r ? ' on' : ''}`}
              onClick={() => {
                setRange(r)
                close()
              }}
            >
              {r === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
