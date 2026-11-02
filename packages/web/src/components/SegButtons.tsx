import type { ReactNode } from 'react'

/** A joined row of one-shot buttons (the design's `.seg`), e.g. "Full | Small" to vote. */
export function SegButtons<T extends string>({
  options,
  onPick,
  label,
  busy = false,
}: {
  options: Array<{ value: T; label: ReactNode }>
  onPick: (v: T) => void
  label: string
  busy?: boolean
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" disabled={busy} onClick={() => onPick(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
