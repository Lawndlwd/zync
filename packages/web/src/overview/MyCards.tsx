import { Link } from 'react-router'

import { Card } from '../components/Card'
import { myCards } from '../helpers/boards'
import { dayLabel, dueDate, pad2 } from '../helpers/dates'
import { boardUrl, wsUrl } from '../helpers/urls'
import { IconWarn } from '../icons'
import type { WorkspaceData } from '../types/workspace'

export function MyCards({ ws, data, now }: { ws: string; data: WorkspaceData; now: Date }) {
  const mine = myCards(data.cards)
  const me = data.people.find((p) => p.id === 'me')
  const initials = (me?.name ?? 'Me')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const target = mine[0] ? `${boardUrl(ws, mine[0].board.path)}?who=me` : wsUrl(ws, 'boards')
  return (
    <Card title="My cards" meta="@me" className="c-mine">
      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 6 }}>
        <span className="av av-me">{initials}</span>
        <span className="num">{pad2(mine.length)}</span>
      </div>
      <div className="col">
        {!mine.length && <span className="lr small muted">Nothing assigned to you.</span>}
        {mine.slice(0, 3).map((c) => {
          const d = c.card.due ? dueDate(c.card.due) : null
          const over = d && d < now
          return (
            <Link
              key={c.ref}
              to={`${boardUrl(ws, c.board.path)}?card=${encodeURIComponent(c.card.file)}`}
              className="lr"
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
            >
              <span className="trunc" style={{ maxWidth: '100%' }}>
                {c.card.title}
              </span>
              {over ? (
                <span className="mono-s danger-t row g4">
                  <IconWarn />
                  Overdue · {dayLabel(d)}
                </span>
              ) : (
                <span className="mono-s muted">{d ? dayLabel(d) : 'No due date'}</span>
              )}
            </Link>
          )
        })}
      </div>
      {mine.length > 0 && (
        <Link to={target} className="link" style={{ marginTop: 10 }}>
          [View all {mine.length} ↗]
        </Link>
      )}
    </Card>
  )
}
