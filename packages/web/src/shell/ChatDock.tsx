import { useRef, useState } from 'react'

import { useEventListener } from '../hooks/useEventListener'
import { useInterval } from '../hooks/useInterval'
import {
  IconBoard,
  IconCalendar,
  IconClock,
  IconCollapseDock,
  IconExpand,
  IconFile,
  IconGrid,
  IconMemory,
  IconPeople,
  IconPopout,
  IconSettings,
  IconSpark,
} from '../icons'
import type { DockMode, ViewContext } from '../types/shell'
import { lastChatSession, rememberChatSession, sessionFromPath } from './chatSession'

const CTX_ICON = {
  overview: <IconGrid size={11} />,
  file: <IconFile size={11} />,
  files: <IconFile size={11} />,
  board: <IconBoard size={11} />,
  boards: <IconBoard size={11} />,
  jobs: <IconClock size={11} />,
  calendar: <IconCalendar size={11} />,
  opencode: <IconSpark size={11} />,
  people: <IconPeople size={11} />,
  memory: <IconMemory size={11} />,
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
  view,
  onOpen,
  onFull,
  onCollapse,
}: {
  ws: string
  mode: DockMode
  width: string
  frames: Record<string, string>
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
  const frameBox = useRef<HTMLDivElement>(null)

  // Settings changed one of the chat's preferences: reload it so opencode reads them again.
  useEventListener('zync:chat-reload', () => {
    for (const f of frameBox.current?.querySelectorAll('iframe') ?? []) f.contentWindow?.location.reload()
  })

  // Remember which conversation each workspace's chat is showing, so a reload reopens it. Paused
  // while the dock is hidden: the conversation can't change then.
  useInterval(
    () => {
      for (const f of frameBox.current?.querySelectorAll<HTMLIFrameElement>('iframe[data-ws]') ?? []) {
        try {
          const id = sessionFromPath(f.contentWindow?.location.pathname ?? '')
          const name = f.dataset.ws
          if (id && name && id !== lastChatSession(name)) rememberChatSession(name, id)
        } catch {
          // not loaded yet
        }
      }
    },
    mode === 'rail' ? null : 1500,
  )

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
        <div className="frame" ref={frameBox}>
          {Object.entries(frames).map(([name, url]) => (
            <iframe
              // oxlint-disable-next-line react/iframe-missing-sandbox -- opencode's web UI is same-origin and trusted; needs scripts + same-origin for localStorage
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              key={name}
              data-ws={name}
              title={`AI chat – ${name}`}
              src={url}
              allow="clipboard-read; clipboard-write; microphone"
              style={{ display: name === ws ? undefined : 'none' }}
              onLoad={() => setLoaded((l) => ({ ...l, [name]: true }))}
            />
          ))}
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
            {loaded[ws] ? 'Connected' : 'Connecting…'}
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
