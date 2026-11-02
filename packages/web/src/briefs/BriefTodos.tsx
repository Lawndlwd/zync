import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { Checkbox } from '../components/Checkbox'
import { useToast } from '../components/Dialog'
import { Select } from '../components/Select'
import { TextButton } from '../components/TextButton'
import { cardUrl } from '../helpers/briefs'
import { errorMessage } from '../helpers/format'
import { usePref } from '../hooks/usePref'
import type { Brief, Todo } from '../types/briefs'

/**
 * A brief's suggested to-dos, the checklist at the top of its page: tick one when done, or [→ Card]
 * turns it into a card (due that day) on the chosen board, and the row then links to it.
 */
export function BriefTodos({ ws, date, todos }: { ws: string; date: string; todos: Todo[] }) {
  const qc = useQueryClient()
  const toast = useToast()
  const boards = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  const [pref, setPref] = usePref<string>('zync:briefBoard', '')
  const [busy, setBusy] = useState<number | null>(null)
  const list = boards.data ?? []
  // The last board used, while it still exists; else the first one.
  const board = list.some((b) => b.path === pref) ? pref : (list[0]?.path ?? '')

  const tick = async (index: number, done: boolean) => {
    // Shown at once; the page is rewritten, and a failure puts the box back.
    qc.setQueryData<Brief | null>(['briefs', ws, date], (b) =>
      b ? { ...b, todos: b.todos.map((t, i) => (i === index ? { ...t, done } : t)) } : b,
    )
    try {
      await api.setBriefTodoDone(ws, date, index, done)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
    await qc.invalidateQueries({ queryKey: ['briefs', ws] })
  }

  const toCard = async (index: number) => {
    setBusy(index)
    try {
      await api.briefTodoToCard(ws, date, index, board)
      toast(`Card created on ${board}`)
      void qc.invalidateQueries({ queryKey: ['board', ws] })
      void qc.invalidateQueries({ queryKey: ['calendar', ws] })
      await qc.invalidateQueries({ queryKey: ['briefs', ws] })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(null)
    }
  }

  if (!todos.length) return <span className="small muted">No to-dos suggested for this day.</span>
  const open = todos.some((t) => !t.card && !t.done)
  return (
    <div className="col">
      {open && (
        <div className="row g8 wrap" style={{ marginBottom: 4 }}>
          <span className="mono-s muted">Cards go to</span>
          <div style={{ minWidth: 180 }}>
            {list.length ? (
              <Select
                compact
                ariaLabel="Board for new cards"
                value={board}
                onChange={setPref}
                options={list.map((b) => ({ value: b.path, label: b.name, text: b.path }))}
              />
            ) : (
              <span className="small muted">no board yet: create one on the Boards page</span>
            )}
          </div>
        </div>
      )}
      {todos.map((t, i) => (
        <div
          key={`${t.title}|${t.source ?? ''}|${t.link ?? ''}`}
          className={`lr wrap brief-todo${t.done ? ' done' : ''}`}
        >
          <Checkbox checked={t.done} label={t.title} onChange={(done) => void tick(i, done)} />
          <span className="grow col t">
            <span>{t.title}</span>
            {t.source && <span className="mono-s muted">{t.source}</span>}
          </span>
          {t.link && /^https?:/.test(t.link) && (
            <a className="link" href={t.link} target="_blank" rel="noreferrer">
              [Open ↗]
            </a>
          )}
          {t.card ? (
            <Link className="link" to={cardUrl(ws, t.card)}>
              [✓ Card]
            </Link>
          ) : (
            !t.done && (
              <TextButton disabled={!board || busy !== null} onClick={() => void toCard(i)}>
                {busy === i ? '[…]' : '[→ Card]'}
              </TextButton>
            )
          )}
        </div>
      ))}
    </div>
  )
}
