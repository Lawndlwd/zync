import type { ReactNode } from 'react'

export function PaneHeader({ title, active, children }: { title: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <div className={`pane-h${active ? ' active' : ''}`}>
      {active && <span className="pane-dot" aria-hidden="true" />}
      <span className="mono trunc">{title}</span>
      {active && <span className="mono-s pane-tag">Selected</span>}
      <span className="grow" />
      {children}
    </div>
  )
}
