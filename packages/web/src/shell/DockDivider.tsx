import type { RefObject } from 'react'

import { clampDockPct } from './helpers'

export function DockDivider({
  appRef,
  pct,
  setPct,
  setDragging,
}: {
  appRef: RefObject<HTMLDivElement | null>
  pct: number
  setPct: (p: number) => void
  setDragging: (d: boolean) => void
}) {
  return (
    <div
      className="divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat panel"
      aria-valuemin={30}
      aria-valuemax={60}
      aria-valuenow={Math.round(pct * 100)}
      tabIndex={0}
      onDoubleClick={() => setPct(0.45)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPct(clampDockPct(pct + 0.02))
        if (e.key === 'ArrowRight') setPct(clampDockPct(pct - 0.02))
      }}
      onPointerDown={(e) => {
        const app = appRef.current
        if (!app) return
        e.preventDefault()
        const rect = app.getBoundingClientRect()
        setDragging(true)
        const move = (ev: PointerEvent) => setPct(clampDockPct((rect.right - ev.clientX) / rect.width))
        const up = () => {
          setDragging(false)
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    >
      <i />
    </div>
  )
}
