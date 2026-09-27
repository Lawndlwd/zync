import type { DragEvent } from 'react'
import { Link } from 'react-router'

import { PersonAvatar } from '../components/PersonAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { TextButton } from '../components/TextButton'
import { dayLabel, dueDate, hhmm, shortDayTime } from '../helpers/dates'
import { stopPropagation } from '../helpers/dom'
import { firstLine } from '../helpers/format'
import { sessionUrl } from '../helpers/urls'
import { IconWarn } from '../icons'
import type { Card } from '../types/boards'
import type { Person } from '../types/people'

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
            <StatusBadge state="ok">Done{ai.finishedAt ? ` · ${shortDayTime(ai.finishedAt)}` : ''}</StatusBadge>
          ) : state === 'failed' ? (
            <StatusBadge state="failed">Failed{ai.finishedAt ? ` · ${shortDayTime(ai.finishedAt)}` : ''}</StatusBadge>
          ) : card.runAt ? (
            <StatusBadge state="scheduled">{shortDayTime(card.runAt)}</StatusBadge>
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
            <TextButton onClick={stopPropagation(onAccept)}>[✓] Accept</TextButton>
            {ai?.sessionId && (
              <Link to={sessionUrl(ws, ai.sessionId)} className="link" onClick={(e) => e.stopPropagation()}>
                [↗] Session
              </Link>
            )}
          </span>
        ) : state === 'failed' && !done ? (
          <span className="row g10">
            <TextButton onClick={stopPropagation(onRetry)}>[↻] Retry</TextButton>
            {ai?.sessionId && (
              <Link to={sessionUrl(ws, ai.sessionId)} className="link" onClick={(e) => e.stopPropagation()}>
                [↗] Session
              </Link>
            )}
          </span>
        ) : overdue ? (
          <span className="due over">
            <IconWarn />
            Overdue · {dayLabel(due).slice(4)}
          </span>
        ) : (
          <span className="due">
            {done
              ? 'Done'
              : due
                ? `${card.assignee === 'ai' ? 'Due ' : ''}${dayLabel(due)}${card.due?.includes('T') ? ` · ${hhmm(due)}` : ''}`
                : 'No date'}
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
