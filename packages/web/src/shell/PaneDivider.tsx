import type { RefObject } from 'react'

import { shiftSizes } from './helpers'

/**
 * Drag handle between side `index` and side `index + 1`. Moves width from one to the other,
 * never below MIN_PANE_PX; double-click resets to equal widths; ←/→ nudge when focused.
 */
export function PaneDivider({
  index,
  sizes,
  setSizes,
  container,
  setDragging,
}: {
  index: number
  sizes: number[]
  setSizes: (s: number[]) => void
  container: RefObject<HTMLElement | null>
  setDragging: (d: boolean) => void
}) {
  const shift = (start: number[], deltaPx: number, width: number) => shiftSizes(start, index, deltaPx, width)
  const width = () => {
    const el = container.current
    if (!el) return 0
    // Space the sides share (the dividers themselves don't grow).
    const dividers = el.querySelectorAll(':scope > .pane-divider').length
    return el.getBoundingClientRect().width - dividers * 12
  }
  return (
    <div
      className="divider pane-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(((sizes[index] ?? 0) / sizes.reduce((a, b) => a + b, 0)) * 100)}
      tabIndex={0}
      onDoubleClick={() => setSizes(Array(sizes.length).fill(1))}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0
        if (!step) return
        e.preventDefault()
        setSizes(shift(sizes, step, width()))
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        const target = e.currentTarget
        target.setPointerCapture(e.pointerId)
        const startX = e.clientX
        const start = [...sizes]
        const w = width()
        setDragging(true)
        const move = (ev: PointerEvent) => setSizes(shift(start, ev.clientX - startX, w))
        const up = (ev: PointerEvent) => {
          target.releasePointerCapture(ev.pointerId)
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', up)
          setDragging(false)
        }
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', up)
      }}
    >
      <i />
    </div>
  )
}
