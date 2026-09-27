import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router'
import { api, basename, chatUrlFor, dirname } from './api'
import { ChatDock, Divider, type ViewContext } from './shell/ChatDock'
import { CommandPalette } from './shell/CommandPalette'
import { applyChatDefaults, reloadChat } from './shell/chatAppearance'
import { lastChatSession, rememberChatSession, sessionExists } from './shell/chatSession'
import { type Creating, isTyping, type Shell, ShellContext, usePref, useTheme, writePref, wsUrl } from './shell/context'
import { PaneDivider, PaneHeader, SplitPane, usePaneSizes } from './shell/Pane'
import { panesFromSearch, splitPath, withoutPanes, withPanes } from './shell/paneUrl'
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
        if (p.startsWith('.zync/memory/')) qc.invalidateQueries({ queryKey: ['memory'] })
        if (p.startsWith('.opencode/jobs/')) {
          qc.invalidateQueries({ queryKey: ['jobs', ws] })
          qc.invalidateQueries({ queryKey: ['runs', ws] })
        }
        if (!p.split('/').some((s) => s.startsWith('.'))) visible = true
        // Boards are ordinary folders: any markdown change may be a card (the AI, the scheduler or
        // the file editor can all write them). Only boards currently on screen refetch.
        if (p.endsWith('.md') || p.endsWith('.board.json')) qc.invalidateQueries({ queryKey: ['board', ws] })
        if (p.endsWith('.board.json')) qc.invalidateQueries({ queryKey: ['boards', ws] })
        // Events, cards and jobs (and their runs) all show on the calendar.
        if (p.endsWith('.md') || p.startsWith('.opencode/jobs/')) qc.invalidateQueries({ queryKey: ['calendar', ws] })
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

interface Pane {
  id: string
  path: string
}

const MAX_PANES = 2
let paneSeq = 0
const newPaneId = () => `pane-${Date.now()}-${paneSeq++}`

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
    case 'calendar':
      return { kind: 'calendar', label: 'Calendar' }
    case 'opencode':
      return { kind: 'opencode', label: sub ? basename(sub) : 'OpenCode' }
    case 'people':
      return { kind: 'people', label: 'People' }
    case 'memory':
      return { kind: 'memory', label: 'Memory' }
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
  // The chat's own light/dark (and a first theme) follow zync's — see shell/chatAppearance.
  useEffect(() => {
    if (applyChatDefaults(theme)) reloadChat()
  }, [theme])
  useEffect(() => writePref('zync:lastWorkspace', ws), [ws])
  useEffect(() => setDrawer(false), [location.pathname])

  useEffect(() => {
    if (!config) return
    const dir = `${config.workspacesRoot.replace(/\/$/, '')}/${ws}`
    if (sessionParam) {
      const url = chatUrlFor(dir, sessionParam)
      setFrames((f) => (f[ws] === url ? f : { ...f, [ws]: url }))
      return
    }
    if (frames[ws]) return
    // First time the chat opens for this workspace: resume the last conversation if it still exists.
    let cancelled = false
    const saved = lastChatSession(ws)
    void (saved ? sessionExists(dir, saved) : Promise.resolve(false)).then((ok) => {
      if (cancelled) return
      if (saved && !ok) rememberChatSession(ws, null)
      const url = chatUrlFor(dir, ok && saved ? saved : undefined)
      setFrames((f) => (f[ws] ? f : { ...f, [ws]: url }))
    })
    return () => {
      cancelled = true
    }
  }, [config, ws, sessionParam, frames])

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

  // Split panes beside the main view (up to 2). The layout owns them and mirrors them into the URL
  // (?p1=…&p2=…, see shell/paneUrl), so a split can be shared, bookmarked and differ per tab.
  const navType = useNavigationType()
  const [panes, setPanesState] = useState<Pane[]>(() =>
    panesFromSearch(ws, location.search).map((path) => ({ id: newPaneId(), path })),
  )
  const panesRef = useRef(panes)
  panesRef.current = panes
  const locRef = useRef(location)
  locRef.current = location

  /** Change the panes and write them into the current URL (push = a Back-able step). */
  const commit = useCallback(
    (next: Pane[], opts: { push?: boolean; to?: string } = {}) => {
      panesRef.current = next
      setPanesState(next)
      const loc = locRef.current
      const target = opts.to ? splitPath(opts.to) : { pathname: loc.pathname, search: loc.search }
      navigate(
        {
          pathname: target.pathname,
          search: withPanes(
            ws,
            target.search,
            next.map((p) => p.path),
          ),
        },
        { replace: !opts.push },
      )
    },
    [navigate, ws],
  )

  // Keep URL and panes in step. A link in the main view builds a URL without the pane parameters:
  // put them back. Back/Forward (POP) or a pasted link: the URL wins.
  useEffect(() => {
    const url = panesFromSearch(ws, location.search)
    const cur = panesRef.current.filter((p) => p.path.startsWith(`/w/${encodeURIComponent(ws)}/`))
    const same = url.length === cur.length && url.every((u, i) => u === cur[i].path)
    if (same) {
      if (cur.length !== panesRef.current.length) setPanesState(cur)
      return
    }
    if (navType !== 'POP' && url.length === 0 && cur.length) {
      navigate(
        {
          pathname: location.pathname,
          search: withPanes(
            ws,
            location.search,
            cur.map((p) => p.path),
          ),
        },
        { replace: true },
      )
      return
    }
    // Reuse ids for panes that are still there, so they don't remount.
    const next = url.map((path) => cur.find((p) => p.path === path) ?? { id: newPaneId(), path })
    panesRef.current = next
    setPanesState(next)
  }, [location.search, location.pathname, navType, ws, navigate])

  const openBeside = useCallback(
    (path: string) => {
      const id = newPaneId()
      commit([...panesRef.current.filter((p) => p.path !== path), { id, path }].slice(-MAX_PANES), { push: true })
      setActive(id)
    },
    [commit],
  )
  const setPanePath = useCallback(
    (id: string, path: string) => {
      const ps = panesRef.current
      // Nothing changed: no URL write, no re-render.
      if (!ps.some((p) => p.id === id && p.path !== path)) return
      commit(ps.map((p) => (p.id === id ? { ...p, path } : p)))
    },
    [commit],
  )
  // The selected side: sidebar and ⌘K open things there. 'main' = the main view.
  const [active, setActive] = useState<string>('main')
  const paneNav = useRef<Record<string, (to: string) => void>>({})
  const registerNav = useCallback((id: string, go: ((to: string) => void) | null) => {
    if (go) paneNav.current[id] = go
    else delete paneNav.current[id]
  }, [])
  const activePane = panes.find((p) => p.id === active)
  useEffect(() => {
    if (active !== 'main' && !panes.some((p) => p.id === active)) setActive('main')
  }, [panes, active])
  const open = useCallback(
    (path: string) => {
      const go = activePane && paneNav.current[activePane.id]
      if (go) go(path)
      else navigate(path)
    },
    [activePane, navigate],
  )
  const activePath = activePane ? activePane.path : location.pathname + location.search
  const sides = useMemo(
    () => [{ id: 'main', path: location.pathname + withoutPanes(location.search) }, ...panes],
    [location.pathname, location.search, panes],
  )
  const openInOther = useCallback(
    (fromId: string, path: string) => {
      if (!panes.length) return false
      const target = sides.find((s) => s.id !== fromId)
      if (!target) return false
      if (target.id === 'main') navigate(path)
      else paneNav.current[target.id]?.(path)
      return true
    },
    [panes.length, sides, navigate],
  )
  const panesBox = useRef<HTMLDivElement>(null)
  const [paneSizes, setPaneSizes] = usePaneSizes(1 + panes.length)
  const grow = (i: number) => ({ flexGrow: paneSizes[i] ?? 1 })
  const closePane = (id: string) => commit(panesRef.current.filter((p) => p.id !== id))
  const closeAll = () => commit([])
  const makeMain = (id: string) => {
    const pane = panes.find((p) => p.id === id)
    if (!pane) return
    // Swap: the pane's view becomes the main one, the main view moves into the pane.
    const mainPath = location.pathname + withoutPanes(location.search)
    setActive('main')
    commit(
      panes.map((p) => (p.id === id ? { id: newPaneId(), path: mainPath } : p)),
      { push: true, to: pane.path },
    )
  }
  const escapeToMain = useCallback(
    (id: string, path: string) =>
      commit(
        panesRef.current.filter((p) => p.id !== id),
        { push: true, to: path },
      ),
    [commit],
  )

  const shell: Shell = useMemo(
    () => ({
      ws,
      dock,
      toggleDock,
      toggleFull,
      openPalette: () => setPalette(true),
      startCreate,
      openBeside,
      open,
      activePath,
      sides,
      openInOther,
      theme,
      setTheme,
    }),
    [ws, dock, toggleDock, toggleFull, startCreate, openBeside, open, activePath, sides, openInOther, theme, setTheme],
  )

  // ⌘K palette · ⌘J dock · ⌘⇧J full chat · ⌘\ sidebar · G then O/F/B/C/J · Esc leaves full chat.
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
          const to = { o: 'overview', f: 'files', b: 'boards', c: 'calendar', j: 'jobs' }[k]
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
            <main
              className="main guides"
              onClickCapture={(e) => {
                // ⌥-click any in-app link to open it beside the current view.
                const a = (e.target as HTMLElement).closest('a[href]')
                const href = a?.getAttribute('href')
                if (e.altKey && href?.startsWith('/w/')) {
                  e.preventDefault()
                  e.stopPropagation()
                  openBeside(href)
                }
              }}
            >
              <div ref={panesBox} className={`panes${panes.length ? ' split' : ''}`}>
                <section
                  className={`pane primary${panes.length && active === 'main' ? ' active' : ''}`}
                  style={grow(0)}
                  aria-label="Main view"
                  onPointerDownCapture={() => setActive('main')}
                  onFocusCapture={() => setActive('main')}
                >
                  {panes.length > 0 && (
                    <PaneHeader title={viewOf(ws, location.pathname)?.label ?? ''} active={active === 'main'}>
                      <button type="button" className="link muted" onClick={closeAll}>
                        [Close split]
                      </button>
                    </PaneHeader>
                  )}
                  <div className="pane-scroll">
                    <Outlet />
                  </div>
                </section>
                {panes.map((p, i) => [
                  <PaneDivider
                    key={`d-${p.id}`}
                    index={i}
                    sizes={paneSizes}
                    setSizes={setPaneSizes}
                    container={panesBox}
                    setDragging={setDragging}
                  />,
                  <SplitPane
                    key={p.id}
                    id={p.id}
                    style={grow(i + 1)}
                    path={p.path}
                    title={viewOf(ws, p.path.split('?')[0])?.label ?? ''}
                    onPath={(path) => setPanePath(p.id, path)}
                    onEscape={(path) => escapeToMain(p.id, path)}
                    onMakeMain={() => makeMain(p.id)}
                    onClose={() => closePane(p.id)}
                    active={active === p.id}
                    onSelect={() => setActive(p.id)}
                    register={(go) => registerNav(p.id, go)}
                  />,
                ])}
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
