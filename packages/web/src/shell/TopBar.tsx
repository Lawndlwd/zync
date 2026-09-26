import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { Button } from '../components/Button'
import { TextInput } from '../components/Field'
import { IconBell, IconChevDown, IconMenu, IconPlus, IconSearch, IconSpin } from '../icons'
import { initials, StatusBadge, useDismiss } from '../ui'
import { ago, hhmm, runningCards, sameDay, upcoming, type WorkspaceData, weekday } from '../workspaceData'
import { type Theme, usePref, useShell, wsUrl } from './context'

export function TopBar({
  data,
  theme,
  setTheme,
  onMenu,
}: {
  data: WorkspaceData
  theme: Theme
  setTheme: (t: Theme) => void
  onMenu: () => void
}) {
  const shell = useShell()
  const now = new Date()
  const running = runningCards(data.cards).length
  const next = upcoming(data.jobs, data.cards, now)[0]
  const nextLabel = next
    ? sameDay(next.time, now)
      ? hhmm(next.time)
      : `${weekday(next.time)} ${hhmm(next.time)}`
    : null
  const me = data.people.find((p) => p.id === 'me')
  const dockOpen = shell.dock !== 'rail'

  return (
    <header className="top">
      <button className="ibtn show-narrow" aria-label="Open navigation" onClick={onMenu}>
        <IconMenu />
      </button>
      <div className="wordmark">
        <i />
        ZYNC
      </div>
      <WorkspaceSwitcher />
      <button className="search gsearch" aria-label="Search or run a command" onClick={shell.openPalette}>
        <IconSearch />
        <span className="grow" style={{ textAlign: 'left' }}>
          Search pages, cards, jobs… or type a command
        </span>
        <span className="kbd">⌘K</span>
      </button>
      <div className="row g8" style={{ marginLeft: 'auto' }}>
        <button
          className={`aistat${dockOpen ? ' on' : ''}`}
          aria-label={`AI status — ${dockOpen ? 'close' : 'open'} chat`}
          aria-pressed={dockOpen}
          onClick={shell.toggleDock}
        >
          {running > 0 && <IconSpin />}
          {running > 0 ? `${running} running` : 'Idle'}
          {nextLabel && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>next {nextLabel}
            </>
          )}
          <span className="hide-narrow" style={{ opacity: 0.5 }}>
            ·
          </span>
          <span className="hide-narrow">⌘J</span>
        </button>
        <Notifications data={data} />
        <AccountMenu name={me?.name} theme={theme} setTheme={setTheme} />
      </div>
    </header>
  )
}

function WorkspaceSwitcher() {
  const { ws } = useShell()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: workspaces } = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setCreating(false)
    setErr('')
  }, [])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="ws" aria-label="Switch workspace" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <i />
        {ws}
        <IconChevDown />
      </button>
      {open && (
        <div className="menu pop" style={{ top: 38, left: 0 }} role="menu">
          <span className="mh">Workspaces</span>
          {workspaces?.map((w) => (
            <button
              key={w.name}
              role="menuitem"
              className={`mi${w.name === ws ? ' on' : ''}`}
              onClick={() => {
                close()
                navigate(wsUrl(w.name, 'overview'))
              }}
            >
              <i
                style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--sage-2)', display: 'inline-block' }}
              />
              <span className="grow">{w.name}</span>
            </button>
          ))}
          <span className="sepline" />
          {creating ? (
            <form
              className="col g6"
              style={{ padding: 6 }}
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const created = await api.createWorkspace(name)
                  await qc.invalidateQueries({ queryKey: ['workspaces'] })
                  close()
                  setName('')
                  navigate(wsUrl(created.name, 'overview'))
                } catch (e) {
                  setErr((e as Error).message)
                }
              }}
            >
              <TextInput
                mono
                compact
                autoFocus
                placeholder="workspace name"
                aria-label="New workspace name"
                value={name}
                invalid={!!err}
                onChange={(e) => setName(e.target.value)}
              />
              {err && <span className="help err">{err}</span>}
              <Button variant="primary" size="sm" type="submit" disabled={!name.trim()}>
                Create
              </Button>
            </form>
          ) : (
            <button className="mi" role="menuitem" onClick={() => setCreating(true)}>
              <IconPlus />
              New workspace…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Bell = recent AI runs; unread = failures since you last opened it. */
function Notifications({ data }: { data: WorkspaceData }) {
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

function AccountMenu({ name, theme, setTheme }: { name?: string; theme: Theme; setTheme: (t: Theme) => void }) {
  const { ws } = useShell()
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
        </div>
      )}
    </div>
  )
}
