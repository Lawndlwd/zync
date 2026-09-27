import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { IconButton } from '../components/IconButton'
import { IconCross } from '../icons'

export function PanelShell({
  label,
  crumb,
  open,
  onClose,
  footer,
  children,
}: {
  label: string
  crumb: ReactNode
  open?: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <aside className="panel card-panel" aria-label={label}>
      <div className="panel-h">
        <span className="mono muted trunc">{crumb}</span>
        <span className="grow" />
        {open && (
          <Link to={open} className="ibtn ibtn-s" aria-label="Open as full page" title="Open as full page">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M5 11l6-6M6 5h5v5" />
            </svg>
          </Link>
        )}
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">{children}</div>
      <div className="row between panel-f">{footer}</div>
    </aside>
  )
}
