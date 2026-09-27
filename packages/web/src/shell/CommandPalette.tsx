import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { boardUrl } from '../boards/shared'
import { IconBoard, IconClock, IconFile, IconPlus, IconSearch, IconSpark, IconSplit } from '../icons'
import { highlight, matchesAll, queryWords } from '../textMatch'
import { ago, type WorkspaceData } from '../workspaceData'
import { fileUrl, useShell, wsUrl } from './context'

interface Item {
  id: string
  group: 'Pages & cards' | 'In files' | 'Jobs' | 'Actions'
  icon: ReactNode
  text: ReactNode
  meta?: ReactNode
  /** Second line (a matching line from the file). */
  sub?: ReactNode
  kbd?: string
  /** Where it leads, when it's a place (lets ⌥↵ open it beside). */
  to?: string
  run: () => void
}

export function CommandPalette({ data, onClose }: { data: WorkspaceData; onClose: () => void }) {
  const shell = useShell()
  const { ws } = shell
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Full-text search inside files, debounced while typing.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 180)
    return () => clearTimeout(t)
  }, [q])
  const inFiles = useQuery({
    queryKey: ['search', ws, debounced],
    queryFn: () => api.search(ws, debounced),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  })
  const hits = debounced.length >= 2 ? (inFiles.data?.results ?? []) : []

  const items = useMemo(() => {
    const query = q.trim()
    const words = queryWords(query)
    const m = (s: string) => !words.length || matchesAll(s, words)
    const hl = (s: string) => highlight(s, words)
    const go = (to: string) => () => {
      onClose()
      shell.open(to)
    }
    const place = (to: string) => ({ to, run: go(to) })
    const out: Item[] = []
    const cardRefs = new Set(data.cards.map((c) => c.ref))
    for (const c of data.cards) {
      if (!m(c.card.title)) continue
      out.push({
        id: `card:${c.ref}`,
        group: 'Pages & cards',
        icon: <IconBoard size={14} />,
        text: hl(c.card.title),
        meta: <span className="mono-s">{c.board.name} · card</span>,
        ...place(`${boardUrl(ws, c.board.path)}?card=${encodeURIComponent(c.card.file)}`),
      })
    }
    for (const f of data.recent) {
      if (cardRefs.has(f.path) || !m(f.path)) continue
      out.push({
        id: `file:${f.path}`,
        group: 'Pages & cards',
        icon: <IconFile size={14} />,
        text: hl(f.path),
        meta: <span className="mono-s muted">edited {ago(new Date(f.mtime))}</span>,
        ...place(fileUrl(ws, f.path)),
      })
    }
    // Matches inside files (skipping ones already listed by name above).
    const listed = new Set(out.map((i) => i.id.replace(/^(card|file):/, '')))
    const boardPaths = new Set(data.boards.map((b) => b.path))
    for (const h of hits) {
      if (listed.has(h.path)) continue
      const dir = h.path.includes('/') ? h.path.slice(0, h.path.lastIndexOf('/')) : ''
      const isCard = boardPaths.has(dir) && h.path.endsWith('.md')
      const first = h.snippets[0]
      out.push({
        id: `hit:${h.path}`,
        group: 'In files',
        icon: isCard ? <IconBoard size={14} /> : <IconFile size={14} />,
        text: (
          <>
            {dir && <span className="muted">{dir}/</span>}
            {hl(h.name)}
          </>
        ),
        sub: first ? (
          <>
            <span className="mono-s muted">L{first.line}</span> {hl(first.text)}
          </>
        ) : undefined,
        meta: <span className="mono-s muted">{ago(new Date(h.mtime))}</span>,
        ...place(isCard ? `${boardUrl(ws, dir)}?card=${encodeURIComponent(h.name)}` : fileUrl(ws, h.path)),
      })
    }
    for (const j of data.jobs) {
      if (j.job?.card || !m(j.name)) continue
      out.push({
        id: `job:${j.name}`,
        group: 'Jobs',
        icon: <IconClock size={14} />,
        text: hl(j.name),
        meta: <span className="mono-s muted">{j.job?.schedule ?? j.job?.at ?? ''}</span>,
        ...place(wsUrl(ws, 'jobs')),
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
        ...place(boardUrl(ws, firstBoard.path)),
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
      ...place(wsUrl(ws, 'jobs')),
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
    return out.slice(0, 60)
  }, [q, data, ws, onClose, shell, hits])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.mi.on')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const groups: Item['group'][] = ['Pages & cards', 'In files', 'Jobs', 'Actions']
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
                const it = items[sel]
                if (e.metaKey || e.ctrlKey) items.find((i) => i.id === 'ask')?.run()
                else if (e.altKey && it?.to) {
                  onClose()
                  shell.openBeside(it.to)
                } else it?.run()
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
                <span className="mh">
                  {g}
                  {g === 'In files' && inFiles.isFetching && ' · searching…'}
                </span>
                {list.map((it) => {
                  idx++
                  const i = idx
                  const on = i === sel
                  return (
                    <button
                      key={it.id}
                      role="option"
                      aria-selected={on}
                      className={`mi${it.sub ? ' tall' : ''}${on ? ' on' : ''}`}
                      onMouseMove={() => setSel(i)}
                      onClick={it.run}
                    >
                      {it.icon}
                      {it.sub ? (
                        <span className="grow col" style={{ textAlign: 'left', minWidth: 0, gap: 2 }}>
                          <span className="trunc">{it.text}</span>
                          <span className="small muted trunc">{it.sub}</span>
                        </span>
                      ) : (
                        <span className="grow trunc" style={{ textAlign: 'left' }}>
                          {it.text}
                        </span>
                      )}
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
          <span>⌥↵ open beside</span>
          <span>⌘↵ ask AI</span>
        </div>
      </div>
    </div>
  )
}
