import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { useDismiss } from '../hooks/useDismiss'
import { IconChevDown, IconPlus } from '../icons'
import { useShell } from './ShellContext'

export function WorkspaceSwitcher() {
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
                void navigate(wsUrl(w.name, 'overview'))
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
                  void navigate(wsUrl(created.name, 'overview'))
                } catch (caught) {
                  setErr(errorMessage(caught))
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
