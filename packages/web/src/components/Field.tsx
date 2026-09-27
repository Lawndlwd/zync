import type { CSSProperties, ReactNode } from 'react'

// Text entry in the zync style: dashed field, solid accent ring on focus, brick on error.

export function Field({
  label,
  help,
  error,
  className = '',
  style,
  children,
}: {
  label?: ReactNode
  help?: ReactNode
  error?: ReactNode
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <label className={`field ${className}`} style={style}>
      {label && <span className="flabel">{label}</span>}
      {children}
      {error ? <span className="help err">{error}</span> : help ? <span className="help">{help}</span> : null}
    </label>
  )
}
