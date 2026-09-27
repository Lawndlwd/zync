import type { ReactNode } from 'react'
import { Link } from 'react-router'

export function ConfigRow({
  icon,
  name,
  hint,
  to,
  action,
  bad,
}: {
  icon: ReactNode
  name: string
  hint: string
  to?: string
  action?: ReactNode
  bad?: boolean
}) {
  const body = (
    <>
      {icon}
      <span className="grow col" style={{ minWidth: 0 }}>
        <span className="oc-name mono-s trunc">{name}</span>
        <span className={`small trunc ${bad ? 'danger-t' : 'muted'}`}>{hint}</span>
      </span>
    </>
  )
  return (
    <div className="row g8 cfg-row">
      {to ? (
        <Link to={to} className="oc-row grow">
          {body}
          <span className="mono-s muted">Open →</span>
        </Link>
      ) : (
        <div className="oc-row grow">{body}</div>
      )}
      {action}
    </div>
  )
}
