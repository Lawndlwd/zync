import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'

import { StatusBadge } from '../components/StatusBadge'
import { ago } from '../helpers/dates'
import { wsUrl } from '../helpers/urls'
import { useDismiss } from '../hooks/useDismiss'
import { usePref } from '../hooks/usePref'
import { IconBell } from '../icons'
import type { WorkspaceData } from '../types/workspace'
import { useShell } from './ShellContext'

/** Bell = recent AI runs; unread = failures since you last opened it. */
export function Notifications({ data }: { data: WorkspaceData }) {
  const { ws } = useShell()
  const [seen, setSeen] = usePref<string>(`zync:seenRuns:${ws}`, '0')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const unread = data.runs.filter(
    (r) => r.run.status !== 'ok' && r.run.status !== 'skipped' && r.time.getTime() > Number(seen),
  ).length
  const items = data.runs.slice(0, 6)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="ibtn"
        style={{ position: 'relative' }}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setSeen(String(Date.now()))
        }}
      >
        <IconBell />
        {unread > 0 && <span className="dot-n">{unread}</span>}
      </button>
      {open && (
        <div className="menu pop" style={{ top: 42, right: 0, width: 360 }}>
          <span className="mh">AI runs</span>
          {!items.length && (
            <span className="small muted" style={{ padding: '6px 10px' }}>
              No runs yet.
            </span>
          )}
          {items.map((r) => (
            <Link key={`${r.job}-${r.run.ts}`} to={wsUrl(ws, 'jobs')} className="mi" onClick={close}>
              <StatusBadge state={r.run.status} />
              <span className="grow trunc small">{r.title}</span>
              <span className="mono-s muted">{ago(r.time)}</span>
            </Link>
          ))}
          <span className="sepline" />
          <Link to={wsUrl(ws, 'jobs')} className="mi link" onClick={close}>
            [All runs ↗]
          </Link>
        </div>
      )}
    </div>
  )
}
