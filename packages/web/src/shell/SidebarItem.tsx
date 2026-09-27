import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

export function SidebarItem({
  to,
  icon,
  label,
  count,
  bad,
}: {
  to: string
  icon: ReactNode
  label: string
  count?: number | string
  bad?: boolean
}) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'on' : '')} aria-label={label}>
      {icon}
      <span className="lbl">{label}</span>
      {count !== undefined && <span className={`c${bad ? ' bad' : ''}`}>{count}</span>}
    </NavLink>
  )
}
