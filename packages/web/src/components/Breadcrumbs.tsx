import type { ReactNode } from 'react'

/** `root / a / b / c`, the last part highlighted. */
export function Breadcrumbs({ root, parts, label }: { root: ReactNode; parts: string[]; label: string }) {
  return (
    <nav className="mono muted row g8 trunc" aria-label={label}>
      {root}
      {parts.map((p, i) => (
        <span key={parts.slice(0, i + 1).join('/')} className="row g8">
          <span>/</span>
          <span style={i === parts.length - 1 ? { color: 'var(--ink)' } : undefined}>{p}</span>
        </span>
      ))}
    </nav>
  )
}
