import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, chatUrlFor, dirname } from './api'
import { FileTree } from './FileTree'
import { NewWorkspaceForm } from './Home'

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

/** Live refresh: file changes on disk (including AI edits) invalidate the matching queries. */
function useWorkspaceEvents(ws: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(api.eventsUrl(ws))
    const pending = new Set<string>()
    let timer: number | undefined
    const flush = () => {
      for (const p of pending) {
        qc.invalidateQueries({ queryKey: ['tree', ws, dirname(p)] })
        qc.invalidateQueries({ queryKey: ['file', ws, p] })
        if (p.startsWith('.opencode/jobs/')) qc.invalidateQueries({ queryKey: ['jobs', ws] })
      }
      pending.clear()
    }
    es.onmessage = (e) => {
      try {
        pending.add(JSON.parse(e.data).path)
        clearTimeout(timer)
        timer = window.setTimeout(flush, 250)
      } catch {}
    }
    return () => {
      clearTimeout(timer)
      es.close()
    }
  }, [ws, qc])
}

export function Layout() {
  const { ws = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity })
  const { data: workspaces } = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })
  const [creating, setCreating] = useState(false)
  const [split, setSplit] = useState(() => readPref('zync:split', '0') === '1')
  // One chat iframe per visited workspace, kept alive so conversations survive navigation.
  const [frames, setFrames] = useState<Record<string, string>>({})

  const isChat = location.pathname.endsWith('/chat')
  const sessionParam = isChat ? search.get('session') : null

  useWorkspaceEvents(ws)

  useEffect(() => writePref('zync:lastWorkspace', ws), [ws])
  useEffect(() => writePref('zync:split', split ? '1' : '0'), [split])

  useEffect(() => {
    if (!config?.chatUrl) return
    const dir = `${config.workspacesRoot.replace(/\/$/, '')}/${ws}`
    setFrames((f) => {
      if (sessionParam) {
        const url = chatUrlFor(config.chatUrl as string, dir, sessionParam)
        return f[ws] === url ? f : { ...f, [ws]: url }
      }
      return f[ws] ? f : { ...f, [ws]: chatUrlFor(config.chatUrl as string, dir) }
    })
  }, [config, ws, sessionParam])

  const chatVisible = isChat || split
  const mainVisible = !isChat

  return (
    <div className="app">
      <header className="topbar">
        <select
          value={ws}
          onChange={(e) => {
            if (e.target.value === '__new') setCreating(true)
            else navigate(`/w/${encodeURIComponent(e.target.value)}/${isChat ? 'chat' : 'files'}`)
          }}
        >
          {workspaces?.map((w) => (
            <option key={w.name} value={w.name}>
              {w.name}
            </option>
          ))}
          <option value="__new">+ New workspace…</option>
        </select>
        <nav>
          <NavLink to="files">Files</NavLink>
          <NavLink to="jobs">Jobs</NavLink>
          <NavLink to="chat">Chat</NavLink>
        </nav>
        <label className="toggle" title="Keep chat open next to files">
          <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Split chat
        </label>
        {creating && (
          <div className="popover">
            <NewWorkspaceForm onDone={() => setCreating(false)} />
            <button onClick={() => setCreating(false)}>Cancel</button>
          </div>
        )}
      </header>
      <div className={`body ${chatVisible && mainVisible ? 'split' : ''}`}>
        {mainVisible && (
          <>
            <aside className="sidebar">
              <FileTree ws={ws} />
            </aside>
            <main className="main">
              <Outlet />
            </main>
          </>
        )}
        <section className="chat" style={{ display: chatVisible ? undefined : 'none' }}>
          {!config ? null : !config.chatUrl ? (
            <div className="center error">CHAT_URL is not configured on the server.</div>
          ) : (
            Object.entries(frames).map(([name, src]) => (
              <iframe
                key={name}
                title={`opencode – ${name}`}
                src={src}
                allow="clipboard-read; clipboard-write; microphone"
                style={{ display: name === ws ? undefined : 'none' }}
              />
            ))
          )}
        </section>
      </div>
    </div>
  )
}
