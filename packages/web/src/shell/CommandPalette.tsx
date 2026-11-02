import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useRef, useState } from 'react'

import { api } from '../api'
import { VoteCircle } from '../becoming/VoteCircle'
import { identityName } from '../helpers/becoming'
import { ago, ymd } from '../helpers/dates'
import { dirname } from '../helpers/paths'
import { highlight, matchesAll, queryWords } from '../helpers/textMatch'
import { boardUrl, fileUrl, identityUrl, trainingUrl, workoutUrl, wsUrl } from '../helpers/urls'
import { useBecomingToday } from '../hooks/useBecomingToday'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useNow } from '../hooks/useNow'
import { useOpenGuide } from '../hooks/useOpenGuide'
import { useRoutines } from '../hooks/useRoutines'
import { useScrollActiveIntoView } from '../hooks/useScrollActiveIntoView'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { useTrainingToday } from '../hooks/useTrainingToday'
import { useVote } from '../hooks/useVote'
import { IconBoard, IconClock, IconFile, IconPlus, IconSearch, IconSpark, IconSplit, IconTraining } from '../icons'
import type { WorkspaceData } from '../types/workspace'
import { useShell } from './ShellContext'

type Item = {
  id: string
  group: 'Pages & cards' | 'In files' | 'Becoming' | 'Training' | 'Jobs' | 'Actions'
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
  const openGuide = useOpenGuide(shell.ws)
  const { ws } = shell
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Full-text search inside files, debounced while typing.
  const debounced = useDebouncedValue(q.trim(), 180)
  const inFiles = useQuery({
    queryKey: ['search', ws, debounced],
    queryFn: ({ signal }) => api.search(ws, debounced, signal),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  })
  const hits = debounced.length >= 2 ? (inFiles.data?.results ?? []) : []
  const now = useNow(60_000)
  const becoming = useBecomingToday(ws, ymd(now))
  const vote = useVote(ws)
  const training = useTrainingToday(ws)
  const routines = useRoutines(ws)
  const starter = useStartWorkout(ws)

  const go = (to: string) => () => {
    onClose()
    shell.open(to)
  }
  const place = (to: string) => ({ to, run: go(to) })
  const items = (() => {
    const query = q.trim()
    const words = queryWords(query)
    const m = (s: string) => !words.length || matchesAll(s, words)
    const hl = (s: string) => highlight(s, words)
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
      const dir = dirname(h.path)
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
    // Becoming: "vote run" → vote for the runner without leaving the page.
    const voteWords = words.filter((w) => w !== 'vote')
    for (const r of becoming.data?.rows ?? []) {
      const name = identityName(r.identity.statement)
      const asked =
        query.length > 0 && (voteWords.length === 0 || matchesAll(`${r.identity.statement} ${name}`, voteWords))
      if (!asked) continue
      if (!r.vote)
        for (const kind of ['full', 'small'] as const)
          out.push({
            id: `vote:${r.identity.file}:${kind}`,
            group: 'Becoming',
            icon: <VoteCircle vote={{ kind, source: 'palette' }} size={14} />,
            text: `Vote: ${name} · ${kind}`,
            meta:
              kind === 'small' && r.identity.small ? (
                <span className="mono-s muted">{r.identity.small.toLowerCase()}</span>
              ) : undefined,
            run: () => {
              onClose()
              void vote(r.identity.file, kind, 'palette')
            },
          })
      out.push({
        id: `identity:${r.identity.file}`,
        group: 'Becoming',
        icon: <IconFile size={14} />,
        text: `Open ${r.identity.file}`,
        ...place(identityUrl(ws, r.identity.file)),
      })
    }
    // Training: resume the workout in progress, start a routine, open the setup.
    const active = training.data?.active
    if (active && m(`resume workout training ${active.name}`))
      out.push({
        id: 'training:resume',
        group: 'Training',
        icon: <IconTraining size={14} />,
        text: `Resume workout · ${active.name}`,
        ...place(workoutUrl(ws, active.file)),
      })
    if (!active && query.length > 0)
      for (const r of routines.data ?? []) {
        if (!matchesAll(`start ${r.name} workout training`, words)) continue
        out.push({
          id: `training:start:${r.file}`,
          group: 'Training',
          icon: <IconTraining size={14} />,
          text: <>Start {hl(r.name)}</>,
          meta: training.data?.planned?.file === r.file ? <span className="mono-s muted">today</span> : undefined,
          run: () => {
            onClose()
            void starter.start(r.file)
          },
        })
      }
    if (query.length > 0 && m('training setup profile goal equipment'))
      out.push({
        id: 'training:setup',
        group: 'Training',
        icon: <IconTraining size={14} />,
        text: 'Training setup',
        ...place(trainingUrl(ws, 'setup')),
      })
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
        if (query) navigator.clipboard.writeText(query).catch(() => {})
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
    if (m('get started guide help tour'))
      out.push({
        id: 'guide',
        group: 'Actions',
        icon: <IconSpark size={14} />,
        text: 'Get started guide',
        run: () => {
          onClose()
          openGuide()
        },
      })
    return out.slice(0, 60)
  })()

  useScrollActiveIntoView(listRef, sel)

  const groups: Array<Item['group']> = ['Pages & cards', 'In files', 'Becoming', 'Training', 'Jobs', 'Actions']
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
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
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
