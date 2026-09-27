import { Link } from 'react-router'

import { Chip } from '../components/Chip'
import { PersonAvatar } from '../components/PersonAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { statusOf } from '../helpers/boards'
import { ago, hhmm, sameDay } from '../helpers/dates'
import { boardUrl } from '../helpers/urls'
import { type usePeople } from '../hooks/usePeople'
import type { Board, Card } from '../types/boards'

export function BoardTile({
  ws,
  board,
  cards,
  people,
  lastEdit,
}: {
  ws: string
  board: Board
  cards: Card[]
  people: ReturnType<typeof usePeople>
  lastEdit?: number
}) {
  const review = cards.filter((c) => c.status === 'review').length
  const running = cards.filter((c) => c.ai?.state === 'running').length
  const next = cards
    .filter((c): c is Card & { runAt: string } => c.ai?.state === 'scheduled' && Boolean(c.runAt))
    .map((c) => new Date(c.runAt))
    .toSorted((a, b) => a.getTime() - b.getTime())[0]
  const assignees = [...new Set(cards.map((c) => c.assignee).filter((a): a is string => Boolean(a)))].slice(0, 5)
  const now = new Date()

  return (
    <Link to={boardUrl(ws, board.path)} className="card board-card" style={{ gap: 16 }}>
      <div className="card-h" style={{ marginBottom: 0 }}>
        <span className="t">{board.name}</span>
        <span className="m">
          {ws}/{board.path}/
        </span>
      </div>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="col g8">
          <span className="row g8 wrap">
            {review > 0 && <Chip n={review} label="In review" />}
            {running > 0 ? (
              <StatusBadge state="running">{running} running</StatusBadge>
            ) : next ? (
              <StatusBadge state="scheduled">
                Next {sameDay(next, now) ? hhmm(next) : next.toDateString().slice(0, 10)}
              </StatusBadge>
            ) : null}
            {!review && !running && !next && <span className="mono-s muted">Nothing waiting</span>}
          </span>
          {assignees.length > 0 && (
            <span className="avstack">
              {assignees.map((id) => (
                <PersonAvatar key={id} id={id} people={people} />
              ))}
            </span>
          )}
        </div>
        <span className="num">{cards.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${board.columns.length}, minmax(0, 1fr))`, gap: 6 }}>
        {board.columns.map((col) => {
          const n = cards.filter((c) => statusOf(board, c) === col.id).length
          const hot = col.id === 'review' && n > 0
          return (
            <div key={col.id} className={`tile${hot ? ' sel' : ''}`} style={{ minHeight: 76 }}>
              <span className={`mono-s trunc${hot ? '' : ' muted'}`}>{col.name}</span>
              <span className="tn">{n}</span>
            </div>
          )
        })}
      </div>
      <div className="row between">
        <span className="mono-s muted">
          {lastEdit ? `Edited ${ago(new Date(lastEdit)).toLowerCase()}` : 'No edits yet'}
        </span>
        <span className="link">[Open ↗]</span>
      </div>
    </Link>
  )
}
