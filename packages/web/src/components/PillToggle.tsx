import type { ReactNode } from 'react'

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
