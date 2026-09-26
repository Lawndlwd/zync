import type { DragEvent } from 'react'
import { Link } from 'react-router'
import type { Card, Person } from '../api'
import { TextButton } from '../components/Button'
import { IconWarn } from '../icons'
import { PersonAvatar, StatusBadge } from '../ui'
import { dayLabel, dueDate, hhmm, sameDay } from '../workspaceData'
import { sessionUrl } from './shared'

const when = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return sameDay(d, new Date()) ? hhmm(d) : `${dayLabel(d).slice(0, 3)} ${hhmm(d)}`
}

const firstLine = (s?: string) =>
  s
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim()

/** A card on the board, in every state the handoff draws: human, @ai scheduled/running/done/failed, overdue, done. */
export function KanbanCard({
  ws,
  card,
  people,
  done,
  selected,
  dragging,
  onOpen,
  onAccept,
  onRetry,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  ws: string
  card: Card
  people: Person[]
  done: boolean
  selected: boolean
  dragging: boolean
  onOpen: () => void
  onAccept: () => void
  onRetry: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
}) {
  const ai = card.assignee === 'ai' ? card.ai : undefined
  const state = ai?.state
  const due = card.due ? dueDate(card.due) : null
  const overdue = !!due && due < new Date() && !done
  const cls = [
    'kcard',
    card.assignee === 'ai' && 'ai',
    state === 'running' && 'running',
    state === 'done' && !done && 'done-ai',
    state === 'failed' && 'failed',
    selected && 'sel',
    dragging && 'ghost',
  ]
    .filter(Boolean)
    .join(' ')
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div
      className={cls}
      style={done ? { opacity: 0.75 } : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={card.title}
      draggable
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {state === 'running' && (
        <svg className="runframe" aria-hidden="true">
          <rect />
        </svg>
      )}
      {ai && !done && (
        <div className="aibar" style={state === 'failed' ? { borderColor: 'var(--danger-soft)' } : undefined}>
          {state === 'running' ? (
            <StatusBadge state="running" />
          ) : state === 'done' ? (
            <StatusBadge state="ok">Done{ai.finishedAt ? ` · ${when(ai.finishedAt)}` : ''}</StatusBadge>
          ) : state === 'failed' ? (
            <StatusBadge state="failed">Failed{ai.finishedAt ? ` · ${when(ai.finishedAt)}` : ''}</StatusBadge>
          ) : card.runAt ? (
            <StatusBadge state="scheduled">{when(card.runAt)}</StatusBadge>
          ) : (
            <span className="mono-s muted">No run time</span>
          )}
          <PersonAvatar id="ai" people={people} />
        </div>
      )}
      {card.labels.length > 0 && (
        <div className="row g4 wrap">
          {card.labels.map((l) => (
            <span key={l} className="label">
              {l}
            </span>
          ))}
        </div>
      )}
      <div
        className="kt"
        style={done ? { textDecoration: 'line-through', textDecorationColor: 'var(--line)' } : undefined}
      >
        {card.title}
      </div>
      {state === 'failed' && !done && ai?.summary && (
        <span className="small danger-t kline">{firstLine(ai.summary)}</span>
      )}
      {state === 'done' && !done && ai?.summary && <span className="small muted kline">{firstLine(ai.summary)}</span>}
      <div className="kf">
        {state === 'done' && !done ? (
          <span className="row g10">
            <TextButton onClick={stop(onAccept)}>[✓] Accept</TextButton>
            {ai?.sessionId && (
              <Link to={sessionUrl(ws, ai.sessionId)} className="link" onClick={(e) => e.stopPropagation()}>
                [↗] Session
              </Link>
            )}
          </span>
        ) : state === 'failed' && !done ? (
          <span className="row g10">
            <TextButton onClick={stop(onRetry)}>[↻] Retry</TextButton>
            {ai?.sessionId && (
              <Link to={sessionUrl(ws, ai.sessionId)} className="link" onClick={(e) => e.stopPropagation()}>
                [↗] Session
              </Link>
            )}
          </span>
        ) : overdue && due ? (
          <span className="due over">
            <IconWarn />
            Overdue · {dayLabel(due).slice(4)}
          </span>
        ) : (
          <span className="due">
            {done ? 'Done' : due ? `${card.assignee === 'ai' ? 'Due ' : ''}${dayLabel(due)}` : 'No date'}
          </span>
        )}
        {state === 'running' && ai?.sessionId ? (
          <Link to={sessionUrl(ws, ai.sessionId)} className="link" onClick={(e) => e.stopPropagation()}>
            [↗] Watch
          </Link>
        ) : (
          card.assignee && card.assignee !== 'ai' && <PersonAvatar id={card.assignee} people={people} />
        )}
      </div>
    </div>
  )
}
