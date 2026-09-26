import { type RefObject, useState } from 'react'
import {
  IconBoard,
  IconClock,
  IconCollapseDock,
  IconExpand,
  IconFile,
  IconGrid,
  IconPeople,
  IconPopout,
  IconSettings,
  IconSpark,
} from '../icons'
import type { DockMode } from './context'

export interface ViewContext {
  kind: 'overview' | 'file' | 'board' | 'jobs' | 'people' | 'boards' | 'files' | 'settings'
  label: string
}

const CTX_ICON = {
  overview: <IconGrid size={11} />,
  file: <IconFile size={11} />,
  files: <IconFile size={11} />,
  board: <IconBoard size={11} />,
  boards: <IconBoard size={11} />,
  jobs: <IconClock size={11} />,
  people: <IconPeople size={11} />,
  settings: <IconSettings size={11} />,
}

/**
 * The AI dock: opencode's web UI in an iframe that is always mounted (one per visited workspace,
 * so sessions survive navigation). Rail = 52px strip; split = resizable column; full = replaces Main.
 */
export function ChatDock({
  ws,
  mode,
  width,
  frames,
  chatUrl,
  view,
  onOpen,
  onFull,
  onCollapse,
}: {
  ws: string
  mode: DockMode
  width: string
  frames: Record<string, string>
  chatUrl: string | null | undefined
  view: ViewContext | null
  onOpen: () => void
  onFull: () => void
  onCollapse: () => void
}) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [hiddenCtx, setHiddenCtx] = useState<string | null>(null)
  const ctxKey = view ? `${view.kind}:${view.label}` : null
  const showCtx = view && hiddenCtx !== ctxKey
  const src = frames[ws]

  return (
    <>
      <section
        className={`dock${mode === 'rail' ? ' hidden' : ''}${mode === 'full' ? ' full' : ''}`}
        style={mode === 'split' ? { width, flexShrink: 0 } : undefined}
        aria-label="AI chat"
      >
        <div className="dock-h">
          <span className="av av-ai">
            <IconSpark size={11} />
          </span>
          <span className="mono">AI · {ws}</span>
          {showCtx && (
            <span className="tag trunc" style={{ height: 24, minWidth: 0 }} title="What Main is showing">
              {CTX_ICON[view.kind]}
              <span className="trunc">Context: {view.label}</span>
              <button aria-label="Remove context" className="muted" onClick={() => setHiddenCtx(ctxKey)}>
                ×
              </button>
            </span>
          )}
          <span className="grow" />
          <button
            className="ibtn ibtn-s"
            aria-label={mode === 'full' ? 'Exit full screen chat (Esc)' : 'Full screen chat (⌘⇧J)'}
            aria-pressed={mode === 'full'}
            onClick={onFull}
          >
            <IconExpand />
          </button>
          <button
            className="ibtn ibtn-s"
            aria-label="Pop out chat"
            disabled={!src}
            onClick={() => src && window.open(src, `zync-chat-${ws}`)}
          >
            <IconPopout />
          </button>
          <button className="ibtn ibtn-s" aria-label="Collapse chat (⌘J)" onClick={onCollapse}>
            <IconCollapseDock />
          </button>
        </div>
        <div className="frame">
          {chatUrl === null ? (
            <div className="empty">
              <span className="mono muted">AI server not configured</span>
              <span className="mono-s muted" style={{ opacity: 0.8 }}>
                Set CHAT_URL on the API server
              </span>
            </div>
          ) : (
            Object.entries(frames).map(([name, url]) => (
              <iframe
                key={name}
                title={`AI chat – ${name}`}
                src={url}
                allow="clipboard-read; clipboard-write; microphone"
                style={{ display: name === ws ? undefined : 'none' }}
                onLoad={() => setLoaded((l) => ({ ...l, [name]: true }))}
              />
            ))
          )}
        </div>
        <div className="row between mono-s muted" style={{ padding: '0 14px 12px' }}>
          <span className="row g6">
            <i
              className={loaded[ws] ? undefined : 'pulse'}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: loaded[ws] ? 'var(--sage-2)' : 'var(--line)',
                display: 'inline-block',
              }}
            />
            {chatUrl === null ? 'Not configured' : loaded[ws] ? 'Connected' : 'Connecting…'}
          </span>
          <span>{mode === 'full' ? 'Esc to return' : 'Drag divider · double-click to reset 45%'}</span>
        </div>
      </section>

      {mode === 'rail' && (
        <aside className="chatrail" aria-label="AI chat (collapsed)">
          <button
            className="ibtn"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            aria-label="Open AI chat (⌘J)"
            onClick={onOpen}
          >
            <IconSpark size={16} />
          </button>
          <span className="kbd">⌘J</span>
          <span className="vlab">AI · {ws}</span>
          <span
            style={{
              marginTop: 'auto',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: loaded[ws] ? 'var(--sage-2)' : 'var(--line)',
            }}
            className="pulse"
            title={loaded[ws] ? 'AI server connected' : 'AI server connecting'}
          />
        </aside>
      )}
    </>
  )
}

/** Drag handle between Main and the split dock (30–60% of the app width). */
export function Divider({
  appRef,
  pct,
  setPct,
  setDragging,
}: {
  appRef: RefObject<HTMLDivElement | null>
  pct: number
  setPct: (p: number) => void
  setDragging: (d: boolean) => void
}) {
  const clamp = (p: number) => Math.min(0.6, Math.max(0.3, p))
  return (
    <div
      className="divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat panel"
      aria-valuemin={30}
      aria-valuemax={60}
      aria-valuenow={Math.round(pct * 100)}
      tabIndex={0}
      onDoubleClick={() => setPct(0.45)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPct(clamp(pct + 0.02))
        if (e.key === 'ArrowRight') setPct(clamp(pct - 0.02))
      }}
      onPointerDown={(e) => {
        const app = appRef.current
        if (!app) return
        e.preventDefault()
        const rect = app.getBoundingClientRect()
        setDragging(true)
        const move = (ev: PointerEvent) => setPct(clamp((rect.right - ev.clientX) / rect.width))
        const up = () => {
          setDragging(false)
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    >
      <i />
    </div>
  )
}
