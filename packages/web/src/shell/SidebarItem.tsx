import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

export function SidebarItem({
  to,
  icon,
  label,
  count,
  bad,
  tour,
}: {
  to: string
  icon: ReactNode
  label: string
  count?: number | string
  bad?: boolean
  /** The "Get started" guide's spotlight target. */
  tour?: string
}) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'on' : '')} aria-label={label} data-tour={tour}>
      {icon}
      <span className="lbl">{label}</span>
      {count !== undefined && <span className={`c${bad ? ' bad' : ''}`}>{count}</span>}
    </NavLink>
  )
}
