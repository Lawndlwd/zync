import { type ReactNode, useCallback, useRef, useState } from 'react'
import { Popover } from './Popover'

/** On/off switch (`.toggle`). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    />
  )
}

/** Soft swatches from the handoff (People → color). */
export const SWATCHES = ['#E8C9A8', '#B9CFD9', '#D8C6E0', '#C9DDB8', '#EBD9A0', '#F0C4BA', '#C4CBB4', '#A9C7C0']

export function SwatchRow({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div className="row g6" role="radiogroup" aria-label="Color">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value?.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          className={`av swatch${value?.toLowerCase() === c.toLowerCase() ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

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

/** Segmented pills (tabs, range pickers). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="row g6" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`pill${o.value === value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A pill that stays pressed (filters that can be combined). */
export function PillToggle({
  pressed,
  onChange,
  children,
}: {
  pressed: boolean
  onChange: (pressed: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`pill pill-toggle${pressed ? ' on' : ''}`}
      onClick={() => onChange(!pressed)}
    >
      {children}
    </button>
  )
}
