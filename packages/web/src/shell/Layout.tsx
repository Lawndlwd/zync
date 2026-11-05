import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  NavigationType,
  Outlet,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from 'react-router'

import { api } from '../api'
import { Spotlight } from '../components/Spotlight'
import { runningCards } from '../helpers/boards'
import { isTyping } from '../helpers/dom'
import { chatUrlFor, sessionUrl, wsUrl } from '../helpers/urls'
import { useHotkeys } from '../hooks/useHotkeys'
import { useNarrow } from '../hooks/useNarrow'
import { PALETTE_SEEN_PREF } from '../hooks/useOnboarding'
import { usePaneSizes } from '../hooks/usePaneSizes'
import { usePref } from '../hooks/usePref'
import { useTheme } from '../hooks/useTheme'
import { useWorkspaceData } from '../hooks/useWorkspaceData'
import { useWorkspaceEvents } from '../hooks/useWorkspaceEvents'
import type { Tip } from '../types/onboarding'
import type { Creating, Pane, Shell } from '../types/shell'
import { applyChatDefaults, reloadChat } from './chatAppearance'
import { ChatDock } from './ChatDock'
import { lastChatSession, rememberChatSession, sessionExists } from './chatSession'
import { CommandPalette } from './CommandPalette'
import { DockDivider } from './DockDivider'
import { isTabPath, viewOf } from './helpers'
import { newPaneId } from './newPaneId'
import { PaneDivider } from './PaneDivider'
import { PaneHeader } from './PaneHeader'
import { panesFromSearch, splitPath, withoutPanes, withPanes } from './paneUrl'
import { writePref } from './prefs'
import { ShellContext } from './ShellContext'
import { Sidebar } from './Sidebar'
import { SplitPane } from './SplitPane'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'

const MAX_PANES = 2

export function Layout() {
  const { ws = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const data = useWorkspaceData(ws)
  const [theme, setTheme] = useTheme()
  const narrow = useNarrow()

  const [splitPref, setSplitPref] = usePref<'rail' | 'split'>('zync:dock', 'rail')
  const [pctPref, setPctPref] = usePref<string>('zync:dockPct', '0.45')
  const [sideCollapsed, setSideCollapsed] = usePref<'0' | '1'>('zync:sideIcons', '0')
  const [palette, setPalette] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)
  // Opening the palette is a "Get started" step; nothing else records it.
  const [, setPaletteSeen] = usePref<'0' | '1'>(PALETTE_SEEN_PREF, '0')
  const openPalette = useCallback(() => {
    setPalette(true)
    setPaletteSeen('1')
  }, [setPaletteSeen])
  const [drawer, setDrawer] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [creating, setCreating] = useState<Creating | null>(null)
  const appRef = useRef<HTMLDivElement>(null)
  // One chat iframe per visited workspace, kept alive so conversations survive navigation.
  const [frames, setFrames] = useState<Record<string, string>>({})

  const isChat = location.pathname.endsWith('/chat')
  const sessionParam = isChat ? search.get('session') : null
  // A phone shows one thing at a time: chat is its own screen, never a column beside the page.
  const dock = isChat ? 'full' : narrow ? 'rail' : splitPref
  // Where full-screen chat returns to: the last non-chat address.
  const [lastPath, setLastPath] = useState(() => wsUrl(ws, 'overview'))
  const here = location.pathname + location.search
  if (!isChat && lastPath !== here) setLastPath(here)

  useWorkspaceEvents(ws)
  // The chat's own light/dark (and a first theme) follow zync's — see shell/chatAppearance.
  useEffect(() => {
    if (applyChatDefaults(theme)) reloadChat()
  }, [theme])
  useEffect(() => writePref('zync:lastWorkspace', ws), [ws])
  // The mobile drawer closes on navigation.
  const [drawerAt, setDrawerAt] = useState(location.pathname)
  if (drawerAt !== location.pathname) {
    setDrawerAt(location.pathname)
    setDrawer(false)
  }

  // The chat runs on zync's own origin (which the api proxies to opencode v2).
  const chatOrigin = window.location.origin
  // A ?session= link points this workspace's chat at that conversation.
  const sessionFrame = sessionParam ? chatUrlFor(chatOrigin, sessionParam) : null
  if (sessionFrame && frames[ws] !== sessionFrame) setFrames((f) => ({ ...f, [ws]: sessionFrame }))
  const hasFrame = frames[ws] !== undefined
  useEffect(() => {
    if (sessionParam || hasFrame) return
    // First time the chat opens for this workspace: resume the last conversation, or create one
    // via zync's api (v2 has no URL for "a new chat in a folder").
    let cancelled = false
    const saved = lastChatSession(ws)
    const open = async (): Promise<string | null> => {
      if (saved && (await sessionExists(saved))) return chatUrlFor(chatOrigin, saved)
      if (saved) rememberChatSession(ws, null)
      try {
        const { id } = await api.createChatSession(ws)
        rememberChatSession(ws, id)
        return chatUrlFor(chatOrigin, id)
      } catch {
        // Leave the frame unset rather than crash — the dock shows its empty state.
        return null
      }
    }
    void open().then((url) => {
      if (cancelled) return null
      if (url) setFrames((f) => (f[ws] ? f : { ...f, [ws]: url }))
      return null
    })
    return () => {
      cancelled = true
    }
  }, [chatOrigin, ws, sessionParam, hasFrame])

  const toggleFull = useCallback(() => {
    if (isChat) void navigate(lastPath)
    else void navigate(wsUrl(ws, 'chat'))
  }, [isChat, navigate, ws, lastPath])

  const openSession = useCallback(
    (sessionId: string) => {
      if (window.innerWidth < 1024) {
        void navigate(sessionUrl(ws, sessionId))
        return
      }
      setFrames((f) => ({ ...f, [ws]: chatUrlFor(chatOrigin, sessionId) }))
      setSplitPref('split')
    },
    [chatOrigin, navigate, setSplitPref, ws],
  )

  const toggleDock = useCallback(() => {
    if (isChat) {
      setSplitPref('rail')
      void navigate(lastPath)
    } else if (window.innerWidth < 1024) toggleFull()
    else setSplitPref(splitPref === 'split' ? 'rail' : 'split')
  }, [isChat, navigate, setSplitPref, splitPref, toggleFull, lastPath])

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
  // The panes as of the last change, for callbacks that run from panes' effects: several changes in
  // one tick (before a re-render) must compose. Every change writes it together with the state.
  const panesRef = useRef(panes)

  /** Change the panes and write them into the current URL (push = a Back-able step). */
  const commit = useCallback(
    (next: Pane[], opts: { push?: boolean; to?: string } = {}) => {
      panesRef.current = next
      setPanesState(next)
      const target = opts.to ? splitPath(opts.to) : { pathname: location.pathname, search: location.search }
      void navigate(
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
    [navigate, ws, location.pathname, location.search],
  )

  // Keep URL and panes in step. A link in the main view builds a URL without the pane parameters:
  // put them back. Back/Forward (POP) or a pasted link: the URL wins.
  useEffect(() => {
    const url = panesFromSearch(ws, location.search)
    const cur = panesRef.current.filter((p) => p.path.startsWith(`${wsUrl(ws)}/`))
    const same = url.length === cur.length && url.every((u, i) => u === cur[i]?.path)
    if (same) {
      if (cur.length !== panesRef.current.length) {
        panesRef.current = cur
        setPanesState(cur)
      }
      return
    }
    if (navType !== NavigationType.Pop && url.length === 0 && cur.length) {
      void navigate(
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

  // The selected side: sidebar and ⌘K open things there. 'main' = the main view (also when the
  // selected pane was closed).
  const [selected, setActive] = useState<string>('main')
  const active = selected === 'main' || panes.some((p) => p.id === selected) ? selected : 'main'

  const openBeside = useCallback(
    (path: string) => {
      // No room for a split on a phone: it opens in place.
      if (narrow) {
        void navigate(path)
        return
      }
      const id = newPaneId()
      commit([...panesRef.current.filter((p) => p.path !== path), { id, path }].slice(-MAX_PANES), { push: true })
      setActive(id)
    },
    [commit, narrow, navigate],
  )
  const setPanePath = useCallback(
    (id: string, path: string) => {
      const ps = panesRef.current
      // Nothing changed: no URL write, no re-render.
      if (!ps.some((p) => p.id === id && p.path !== path)) return
      commit(ps.map((p) => (p.id === id ? Object.assign(p, { path }) : p)))
    },
    [commit],
  )
  const paneNav = useRef<Record<string, (to: string) => void>>({})
  const registerNav = useCallback((id: string, go: ((to: string) => void) | null) => {
    if (go) paneNav.current[id] = go
    else delete paneNav.current[id]
  }, [])
  const activePane = narrow ? undefined : panes.find((p) => p.id === active)
  const open = useCallback(
    (path: string) => {
      const go = activePane && paneNav.current[activePane.id]
      if (go) go(path)
      else void navigate(path)
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
      if (narrow || !panes.length) return false
      const target = sides.find((s) => s.id !== fromId)
      if (!target) return false
      if (target.id === 'main') void navigate(path)
      else paneNav.current[target.id]?.(path)
      return true
    },
    [narrow, panes.length, sides, navigate],
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
      openPalette,
      showTip: setTip,
      startCreate,
      openBeside,
      open,
      activePath,
      sides,
      openInOther,
      openSession,
      theme,
      setTheme,
    }),
    [
      ws,
      dock,
      toggleDock,
      toggleFull,
      openPalette,
      startCreate,
      openBeside,
      open,
      activePath,
      sides,
      openInOther,
      openSession,
      theme,
      setTheme,
    ],
  )

  // ⌘K palette · ⌘J dock · ⌘⇧J full chat · ⌘\ sidebar · G then O/F/B/C/J · Esc leaves full chat.
  const gAt = useRef(0)
  useHotkeys((e) => {
    const mod = e.metaKey || e.ctrlKey
    const k = e.key.toLowerCase()
    if (mod && k === 'k') {
      e.preventDefault()
      if (palette) setPalette(false)
      else openPalette()
    } else if (mod && k === 'j') {
      e.preventDefault()
      if (e.shiftKey) toggleFull()
      else toggleDock()
    } else if (mod && e.key === '\\') {
      e.preventDefault()
      setSideCollapsed(sideCollapsed === '1' ? '0' : '1')
    } else if (e.key === 'Escape' && drawer) {
      setDrawer(false)
    } else if (e.key === 'Escape' && isChat && !palette) {
      void navigate(lastPath)
    } else if (!mod && !e.altKey && !isTyping(e.target) && !palette) {
      if (k === 'g') gAt.current = Date.now()
      else if (Date.now() - gAt.current < 1200) {
        const to = { o: 'overview', f: 'files', b: 'boards', c: 'calendar', j: 'jobs' }[k]
        gAt.current = 0
        if (to) void navigate(wsUrl(ws, to))
      }
    }
  })

  const pct = Number(pctPref) || 0.45

  return (
    <ShellContext.Provider value={shell}>
      <div className="z app-root">
        <TopBar data={data} theme={theme} setTheme={setTheme} narrow={narrow} />
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
                const a = e.target instanceof HTMLElement ? e.target.closest('a[href]') : null
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
                    title={viewOf(ws, splitPath(p.path).pathname)?.label ?? ''}
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
            <DockDivider appRef={appRef} pct={pct} setPct={(p) => setPctPref(p.toFixed(3))} setDragging={setDragging} />
          )}
          <ChatDock
            ws={ws}
            mode={dock}
            width={`calc(${(pct * 100).toFixed(1)}% - 12px)`}
            frames={frames}
            view={viewOf(ws, splitPath(lastPath).pathname)}
            onOpen={toggleDock}
            onFull={toggleFull}
            onCollapse={() => {
              setSplitPref('rail')
              if (isChat) void navigate(lastPath)
            }}
          />
        </div>
        {narrow && (
          <TabBar
            ws={ws}
            running={runningCards(data.cards).length}
            moreOn={drawer || !isTabPath(ws, location.pathname)}
            drawerOpen={drawer}
            onMore={() => setDrawer((d) => !d)}
            onNavigate={() => setDrawer(false)}
          />
        )}
        {palette && <CommandPalette data={data} onClose={() => setPalette(false)} />}
        {tip && <Spotlight key={tip.target} tip={tip} onClose={() => setTip(null)} />}
      </div>
    </ShellContext.Provider>
  )
}
