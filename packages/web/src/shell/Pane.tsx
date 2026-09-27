import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import {
  MemoryRouter,
  Route,
  Routes,
  UNSAFE_LocationContext,
  UNSAFE_RouteContext,
  useLocation,
  useNavigate,
} from 'react-router'
import { IconButton } from '../components/Button'
import { IconCross } from '../icons'
import { workspaceViews } from '../routes'
import { PaneIdContext } from './paneId'

// A split pane: any workspace view (board, page, jobs…) beside the main one. Each pane has its own
// router, so links clicked inside it navigate that pane only.

/** Report the pane's own location changes, and hand the chat route over to the main window. */
function Reporter({ onPath, onEscape }: { onPath: (path: string) => void; onEscape: (path: string) => void }) {
  const loc = useLocation()
  const path = loc.pathname + loc.search
  const cb = useRef({ onPath, onEscape })
  cb.current = { onPath, onEscape }
  useEffect(() => {
    if (/^\/w\/[^/]+\/chat(\/|$)/.test(path)) cb.current.onEscape(path)
    else cb.current.onPath(path)
  }, [path])
  return null
}

/** Lets the layout navigate this pane (sidebar and ⌘K open things in the selected side). */
function NavBridge({ register }: { register: (go: ((to: string) => void) | null) => void }) {
  const navigate = useNavigate()
  const reg = useRef(register)
  reg.current = register
  useEffect(() => {
    reg.current((to) => navigate(to))
    return () => reg.current(null)
  }, [navigate])
  return null
}

function PaneRouter({
  initial,
  onPath,
  onEscape,
  register,
}: {
  initial: string
  onPath: (path: string) => void
  onEscape: (path: string) => void
  register: (go: ((to: string) => void) | null) => void
}) {
  // react-router refuses a router inside a router; a pane is deliberately a separate one, so it
  // starts from an empty router context instead of the main window's.
  return (
    <UNSAFE_LocationContext.Provider value={null as never}>
      <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
        <MemoryRouter initialEntries={[initial]} useTransitions={false}>
          <Reporter onPath={onPath} onEscape={onEscape} />
          <NavBridge register={register} />
          <Routes>
            <Route path="/w/:ws">
              {workspaceViews()}
              <Route path="*" element={<p className="page small muted">Nothing to show here.</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
  )
}

export function PaneHeader({ title, active, children }: { title: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <div className={`pane-h${active ? ' active' : ''}`}>
      {active && <span className="pane-dot" aria-hidden="true" />}
      <span className="mono trunc">{title}</span>
      {active && <span className="mono-s pane-tag">Selected</span>}
      <span className="grow" />
      {children}
    </div>
  )
}

export function SplitPane({
  id,
  path,
  title,
  onPath,
  onEscape,
  onMakeMain,
  onClose,
  style,
  active,
  onSelect,
  register,
}: {
  id: string
  style?: CSSProperties
  path: string
  active: boolean
  onSelect: () => void
  register: (go: ((to: string) => void) | null) => void
  title: ReactNode
  onPath: (path: string) => void
  onEscape: (path: string) => void
  onMakeMain: () => void
  onClose: () => void
}) {
  return (
    <section
      className={`pane${active ? ' active' : ''}`}
      style={style}
      aria-label={`Split pane: ${typeof title === 'string' ? title : 'view'}`}
      onPointerDownCapture={onSelect}
      onFocusCapture={onSelect}
    >
      <PaneHeader title={title} active={active}>
        <IconButton small label="Make this the main view" onClick={onMakeMain}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M2.5 5.5h9M9 3l2.5 2.5L9 8M13.5 10.5h-9M7 8l-2.5 2.5L7 13" />
          </svg>
        </IconButton>
        <IconButton small label="Close pane" onClick={onClose}>
          <IconCross size={13} sw={1.6} />
        </IconButton>
      </PaneHeader>
      <div className="pane-scroll">
        <PaneIdContext.Provider value={id}>
          <PaneRouter initial={path} onPath={onPath} onEscape={onEscape} register={register} />
        </PaneIdContext.Provider>
      </div>
    </section>
  )
}

// ── resizing ───────────────────────────────────────────────────────────────

const MIN_PANE_PX = 280

/**
 * Relative widths of the sides (flex-grow values, summing to the number of sides), remembered per
 * layout size in this browser. Equal widths when nothing is saved or the count changes.
 */
export function usePaneSizes(count: number) {
  const key = `zync:paneSizes:${count}`
  const read = (): number[] => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (Array.isArray(v) && v.length === count && v.every((n) => typeof n === 'number' && n > 0)) return v
    } catch {}
    return Array(count).fill(1)
  }
  const [state, setState] = useState(() => ({ count, sizes: read() }))
  // A pane opened or closed: switch to that layout's saved (or equal) widths.
  const sizes = state.count === count ? state.sizes : read()
  const set = (next: number[]) => {
    setState({ count, sizes: next })
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {}
  }
  return [sizes, set] as const
}

/**
 * Move `deltaPx` of width from side `index + 1` to side `index` (negative = the other way), in a
 * row `widthPx` wide. Neither side goes below MIN_PANE_PX; the other sides don't change.
 */
export function shiftSizes(start: number[], index: number, deltaPx: number, widthPx: number): number[] {
  const total = start.reduce((a, b) => a + b, 0)
  if (!(widthPx > 0) || !total) return start
  const pxPerUnit = widthPx / total
  const pair = start[index] + start[index + 1]
  const min = Math.min(MIN_PANE_PX / pxPerUnit, pair / 2)
  const a = Math.min(pair - min, Math.max(min, start[index] + deltaPx / pxPerUnit))
  const next = [...start]
  next[index] = a
  next[index + 1] = pair - a
  return next
}

/**
 * Drag handle between side `index` and side `index + 1`. Moves width from one to the other,
 * never below MIN_PANE_PX; double-click resets to equal widths; ←/→ nudge when focused.
 */
export function PaneDivider({
  index,
  sizes,
  setSizes,
  container,
  setDragging,
}: {
  index: number
  sizes: number[]
  setSizes: (s: number[]) => void
  container: RefObject<HTMLElement | null>
  setDragging: (d: boolean) => void
}) {
  const shift = (start: number[], deltaPx: number, width: number) => shiftSizes(start, index, deltaPx, width)
  const width = () => {
    const el = container.current
    if (!el) return 0
    // Space the sides share (the dividers themselves don't grow).
    const dividers = el.querySelectorAll(':scope > .pane-divider').length
    return el.getBoundingClientRect().width - dividers * 12
  }
  return (
    <div
      className="divider pane-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((sizes[index] / sizes.reduce((a, b) => a + b, 0)) * 100)}
      tabIndex={0}
      onDoubleClick={() => setSizes(Array(sizes.length).fill(1))}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0
        if (!step) return
        e.preventDefault()
        setSizes(shift(sizes, step, width()))
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        const target = e.currentTarget
        target.setPointerCapture(e.pointerId)
        const startX = e.clientX
        const start = [...sizes]
        const w = width()
        setDragging(true)
        const move = (ev: PointerEvent) => setSizes(shift(start, ev.clientX - startX, w))
        const up = (ev: PointerEvent) => {
          target.releasePointerCapture(ev.pointerId)
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', up)
          setDragging(false)
        }
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', up)
      }}
    >
      <i />
    </div>
  )
}
