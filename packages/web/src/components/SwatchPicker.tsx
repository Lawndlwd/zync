import { useCallback, useRef, useState } from 'react'

import { Popover } from './Popover'
import { SwatchRow } from './SwatchRow'

/** A color square that opens the swatch row in a popover. */
export function SwatchPicker({
  value,
  onChange,
  label = 'Change color',
}: {
  value?: string
  onChange: (c: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`sw sw-btn${open ? ' on' : ''}`}
        style={{ background: value ?? 'var(--sage-1)' }}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      <Popover anchor={ref} open={open} onClose={close} align="end" className="menu" style={{ padding: 8 }}>
        <SwatchRow
          value={value}
          onChange={(c) => {
            onChange(c)
            close()
          }}
        />
      </Popover>
    </>
  )
}
