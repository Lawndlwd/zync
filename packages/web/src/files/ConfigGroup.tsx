import type { ReactNode } from 'react'

export function ConfigGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="col cfg-group">
      <span className="mh mono-s muted">{label}</span>
      {children}
    </div>
  )
}
