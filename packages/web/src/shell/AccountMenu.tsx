import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { initials } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { useDismiss } from '../hooks/useDismiss'
import { useOpenGuide } from '../hooks/useOpenGuide'
import type { Theme } from '../types/shell'
import { useShell } from './ShellContext'

export function AccountMenu({ name, theme, setTheme }: { name?: string; theme: Theme; setTheme: (t: Theme) => void }) {
  const { ws } = useShell()
  const openGuide = useOpenGuide(ws)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const toggle = () => setOpen((o) => !o)
  const label = name && name !== 'Me' ? name : 'Me'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="av av-l av-me" aria-label={`Account — ${label}`} aria-expanded={open} onClick={toggle}>
        {initials(label)}
      </button>
      {open && (
        <div className="menu pop" style={{ top: 42, right: 0 }} role="menu">
          <span className="mh">Theme</span>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              role="menuitemradio"
              aria-checked={theme === t}
              className={`mi${theme === t ? ' on' : ''}`}
              onClick={() => setTheme(t)}
            >
              <span className="grow" style={{ textTransform: 'capitalize' }}>
                {t}
              </span>
            </button>
          ))}
          <span className="sepline" />
          <Link to={wsUrl(ws, 'settings')} className="mi" onClick={close}>
            Settings
          </Link>
          <Link to={wsUrl(ws, 'people')} className="mi" onClick={close}>
            People &amp; your name
          </Link>
          <button
            role="menuitem"
            className="mi"
            onClick={() => {
              close()
              openGuide()
            }}
          >
            Get started guide
          </button>
          <span className="sepline" />
          <button
            role="menuitem"
            className="mi"
            onClick={() =>
              void api.logout().finally(() => {
                window.location.assign('/login')
              })
            }
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
