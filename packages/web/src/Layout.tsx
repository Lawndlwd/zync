import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, basename, chatUrlFor, dirname } from './api'
import { ChatDock, Divider, type ViewContext } from './shell/ChatDock'
import { CommandPalette } from './shell/CommandPalette'
import { type Creating, isTyping, type Shell, ShellContext, usePref, useTheme, writePref, wsUrl } from './shell/context'
import { Sidebar } from './shell/Sidebar'
import { TopBar } from './shell/TopBar'
import { useWorkspaceData } from './workspaceData'

/** Live refresh: file changes on disk (including AI edits) invalidate the matching queries. */
function useWorkspaceEvents(ws: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(api.eventsUrl(ws))
    const pending = new Set<string>()
    let timer: number | undefined
    const flush = () => {
      let visible = false
      for (const p of pending) {
        qc.invalidateQueries({ queryKey: ['tree', ws, dirname(p)] })
        qc.invalidateQueries({ queryKey: ['file', ws, p] })
        if (p.startsWith('.opencode/jobs/')) {
          qc.invalidateQueries({ queryKey: ['jobs', ws] })
          qc.invalidateQueries({ queryKey: ['runs', ws] })
        }
        if (!p.split('/').some((s) => s.startsWith('.'))) visible = true
        // Boards are ordinary folders: any markdown change may be a card (the AI, the scheduler or
        // the file editor can all write them). Only boards currently on screen refetch.
        if (p.endsWith('.md') || p.endsWith('.board.json')) qc.invalidateQueries({ queryKey: ['board', ws] })
        if (p.endsWith('.board.json')) qc.invalidateQueries({ queryKey: ['boards', ws] })
      }
      if (visible) qc.invalidateQueries({ queryKey: ['recent', ws] })
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

function viewOf(ws: string, pathname: string): ViewContext | null {
  const rest = pathname.slice(wsUrl(ws).length + 1)
  const [section, ...tail] = rest.split('/')
  const sub = tail.map(decodeURIComponent).join('/')
  switch (section) {
    case 'overview':
      return { kind: 'overview', label: 'Overview' }
    case 'files':
      return sub ? { kind: 'file', label: basename(sub) } : { kind: 'files', label: 'Files' }
    case 'boards':
      return sub ? { kind: 'board', label: basename(sub) } : { kind: 'boards', label: 'Boards' }
    case 'jobs':
      return { kind: 'jobs', label: 'Jobs' }
    case 'people':
      return { kind: 'people', label: 'People' }
    case 'settings':
      return { kind: 'settings', label: 'Settings' }
    default:
      return null
  }
}

const narrowQuery = () => window.matchMedia('(max-width: 820px)')

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => narrowQuery().matches)
  useEffect(() => {
    const mq = narrowQuery()
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export function Layout() {
  const { ws = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity })
  const data = useWorkspaceData(ws)
  const [theme, setTheme] = useTheme()
  const narrow = useNarrow()

  const [splitPref, setSplitPref] = usePref<'rail' | 'split'>('zync:dock', 'rail')
  const [pctPref, setPctPref] = usePref<string>('zync:dockPct', '0.45')
  const [sideCollapsed, setSideCollapsed] = usePref<'0' | '1'>('zync:sideIcons', '0')
  const [palette, setPalette] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [creating, setCreating] = useState<Creating | null>(null)
  const appRef = useRef<HTMLDivElement>(null)
  // One chat iframe per visited workspace, kept alive so conversations survive navigation.
  const [frames, setFrames] = useState<Record<string, string>>({})

  const isChat = location.pathname.endsWith('/chat')
  const sessionParam = isChat ? search.get('session') : null
  const dock = isChat ? 'full' : splitPref
  const lastPath = useRef(wsUrl(ws, 'overview'))
  if (!isChat) lastPath.current = location.pathname + location.search

  useWorkspaceEvents(ws)
  useEffect(() => writePref('zync:lastWorkspace', ws), [ws])
  useEffect(() => setDrawer(false), [location.pathname])

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

  const toggleFull = useCallback(() => {
    if (isChat) navigate(lastPath.current)
    else navigate(wsUrl(ws, 'chat'))
  }, [isChat, navigate, ws])

  const toggleDock = useCallback(() => {
    if (isChat) {
      setSplitPref('rail')
      navigate(lastPath.current)
    } else if (window.innerWidth < 1024) toggleFull()
    else setSplitPref(splitPref === 'split' ? 'rail' : 'split')
  }, [isChat, navigate, setSplitPref, splitPref, toggleFull])

  const iconsMode = dock !== 'rail' || sideCollapsed === '1'
  const startCreate = useCallback(
    (c: Creating) => {
      setCreating(c)
      if (narrow || iconsMode) setDrawer(true)
    },
    [narrow, iconsMode],
  )

  const shell: Shell = useMemo(
    () => ({ ws, dock, toggleDock, toggleFull, openPalette: () => setPalette(true), startCreate, theme, setTheme }),
    [ws, dock, toggleDock, toggleFull, startCreate, theme, setTheme],
  )

  // ⌘K palette · ⌘J dock · ⌘⇧J full chat · ⌘\ sidebar · G then O/F/B/J · Esc leaves full chat.
  const gAt = useRef(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (mod && k === 'j') {
        e.preventDefault()
        if (e.shiftKey) toggleFull()
        else toggleDock()
      } else if (mod && e.key === '\\') {
        e.preventDefault()
        setSideCollapsed(sideCollapsed === '1' ? '0' : '1')
      } else if (e.key === 'Escape' && isChat && !palette) {
        navigate(lastPath.current)
      } else if (!mod && !e.altKey && !isTyping(e.target) && !palette) {
        if (k === 'g') gAt.current = Date.now()
        else if (Date.now() - gAt.current < 1200) {
          const to = { o: 'overview', f: 'files', b: 'boards', j: 'jobs' }[k]
          gAt.current = 0
          if (to) navigate(wsUrl(ws, to))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleDock, toggleFull, isChat, palette, navigate, ws, sideCollapsed, setSideCollapsed])

  const pct = Number(pctPref) || 0.45

  return (
    <ShellContext.Provider value={shell}>
      <div className="z app-root">
        <TopBar data={data} theme={theme} setTheme={setTheme} onMenu={() => setDrawer((d) => !d)} />
        <div ref={appRef} className={`app${dragging ? ' dragging' : ''}`}>
          {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
          <Sidebar
            ws={ws}
            data={data}
            icons={iconsMode}
            drawer={drawer}
            onNavigate={() => setDrawer(false)}
            creating={creating}
            setCreating={setCreating}
          />
          {dock !== 'full' && (
            <main className="main guides">
              <div className="main-scroll">
                <Outlet />
              </div>
            </main>
          )}
          {dock === 'split' && (
            <Divider appRef={appRef} pct={pct} setPct={(p) => setPctPref(p.toFixed(3))} setDragging={setDragging} />
          )}
          <ChatDock
            ws={ws}
            mode={dock}
            width={`calc(${(pct * 100).toFixed(1)}% - 12px)`}
            frames={frames}
            chatUrl={config ? config.chatUrl : undefined}
            view={viewOf(ws, lastPath.current.split('?')[0])}
            onOpen={toggleDock}
            onFull={toggleFull}
            onCollapse={() => {
              setSplitPref('rail')
              if (isChat) navigate(lastPath.current)
            }}
          />
        </div>
        {palette && <CommandPalette data={data} onClose={() => setPalette(false)} />}
      </div>
    </ShellContext.Provider>
  )
}
