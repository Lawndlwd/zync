import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { boardUrl } from '../boards/shared'
import { IconBoard, IconClock, IconFile, IconPlus, IconSearch, IconSpark, IconSplit } from '../icons'
import { ago, type WorkspaceData } from '../workspaceData'
import { fileUrl, useShell, wsUrl } from './context'

interface Item {
  id: string
  group: 'Pages & cards' | 'Jobs' | 'Actions'
  icon: ReactNode
  text: ReactNode
  meta?: ReactNode
  kbd?: string
  run: () => void
}

/** Case-insensitive match with the hit in bold, as in the handoff's palette. */
function hl(text: string, q: string): ReactNode {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <b>{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  )
}

export function CommandPalette({ data, onClose }: { data: WorkspaceData; onClose: () => void }) {
  const shell = useShell()
  const { ws } = shell
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    const query = q.trim()
    const m = (s: string) => !query || s.toLowerCase().includes(query.toLowerCase())
    const go = (to: string) => () => {
      onClose()
      navigate(to)
    }
    const out: Item[] = []
    const cardRefs = new Set(data.cards.map((c) => c.ref))
    for (const c of data.cards) {
      if (!m(c.card.title)) continue
      out.push({
        id: `card:${c.ref}`,
        group: 'Pages & cards',
        icon: <IconBoard size={14} />,
        text: hl(c.card.title, query),
        meta: <span className="mono-s">{c.board.name} · card</span>,
        run: go(`${boardUrl(ws, c.board.path)}?card=${encodeURIComponent(c.card.file)}`),
      })
    }
    for (const f of data.recent) {
      if (cardRefs.has(f.path) || !m(f.path)) continue
      out.push({
        id: `file:${f.path}`,
        group: 'Pages & cards',
        icon: <IconFile size={14} />,
        text: hl(f.path, query),
        meta: <span className="mono-s muted">edited {ago(new Date(f.mtime))}</span>,
        run: go(fileUrl(ws, f.path)),
      })
    }
    for (const j of data.jobs) {
      if (j.job?.card || !m(j.name)) continue
      out.push({
        id: `job:${j.name}`,
        group: 'Jobs',
        icon: <IconClock size={14} />,
        text: hl(j.name, query),
        meta: <span className="mono-s muted">{j.job?.schedule ?? j.job?.at ?? ''}</span>,
        run: go(wsUrl(ws, 'jobs')),
      })
    }
    const firstBoard = data.boards[0]
    out.push({
      id: 'ask',
      group: 'Actions',
      icon: <IconSpark size={14} />,
      text: query ? `Ask AI “${query}”…` : 'Ask AI…',
      kbd: '⌘↵',
      run: () => {
        onClose()
        if (query) navigator.clipboard?.writeText(query).catch(() => {})
        if (shell.dock === 'rail') shell.toggleDock()
      },
    })
    if (firstBoard)
      out.push({
        id: 'new-card',
        group: 'Actions',
        icon: <IconPlus />,
        text: `New card in ${firstBoard.name}`,
        run: go(boardUrl(ws, firstBoard.path)),
      })
    out.push({
      id: 'new-page',
      group: 'Actions',
      icon: <IconPlus />,
      text: 'New page…',
      run: () => {
        onClose()
        shell.startCreate({ dir: '', kind: 'page' })
      },
    })
    out.push({
      id: 'schedule',
      group: 'Actions',
      icon: <IconPlus />,
      text: 'Schedule an AI job…',
      run: go(wsUrl(ws, 'jobs')),
    })
    out.push({
      id: 'split',
      group: 'Actions',
      icon: <IconSplit />,
      text: 'Toggle split chat',
      kbd: '⌘J',
      run: () => {
        onClose()
        shell.toggleDock()
      },
    })
    return out.slice(0, 40)
  }, [q, data, ws, navigate, onClose, shell])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.mi.on')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const groups: Item['group'][] = ['Pages & cards', 'Jobs', 'Actions']
  let idx = -1

  return (
    <div
      className="palette-wrap"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="palette">
        <div
          className="row g10"
          style={{ height: 56, padding: '0 16px', borderBottom: '1px dashed var(--line)', flexShrink: 0 }}
        >
          <IconSearch size={16} />
          <input
            aria-label="Search or command"
            autoFocus
            value={q}
            placeholder="Search pages, cards, jobs… or type a command"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(items.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (e.metaKey || e.ctrlKey) items.find((i) => i.id === 'ask')?.run()
                else items[sel]?.run()
              }
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div ref={listRef} className="menu" style={{ border: 0, borderRadius: 0, padding: 8 }} role="listbox">
          {groups.map((g) => {
            const list = items.filter((i) => i.group === g)
            if (!list.length) return null
            return (
              <div key={g} className="col" style={{ gap: 2 }}>
                <span className="mh">{g}</span>
                {list.map((it) => {
                  idx++
                  const i = idx
                  const on = i === sel
                  return (
                    <button
                      key={it.id}
                      role="option"
                      aria-selected={on}
                      className={`mi${on ? ' on' : ''}`}
                      onMouseMove={() => setSel(i)}
                      onClick={it.run}
                    >
                      {it.icon}
                      <span className="grow trunc" style={{ textAlign: 'left' }}>
                        {it.text}
                      </span>
                      {it.meta}
                      {on ? <span className="kbd">↵</span> : it.kbd && <span className="kbd">{it.kbd}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div
          className="row g16 mono-s muted"
          style={{ padding: '10px 16px', borderTop: '1px dashed var(--line)', flexShrink: 0 }}
        >
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>⌘↵ ask AI</span>
        </div>
      </div>
    </div>
  )
}
