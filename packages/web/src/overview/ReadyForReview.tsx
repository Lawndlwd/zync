import { Link } from 'react-router'

import { Card } from '../components/Card'
import { pad2 } from '../helpers/dates'
import { boardUrl } from '../helpers/urls'
import { IconSpark } from '../icons'
import type { BoardCard } from '../types/workspace'

export function ReadyForReview({ ws, cards }: { ws: string; cards: BoardCard[] }) {
  return (
    <Card title="Ready for review" meta="Finished by AI" className="c-review">
      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
        <span className="small muted" style={{ maxWidth: 220 }}>
          Cards the AI moved to Review. Accept, or send back with a note.
        </span>
        <span className="num">{pad2(cards.length)}</span>
      </div>
      <div className="col">
        {!cards.length && <span className="lr small muted">Nothing waiting on you.</span>}
        {cards.slice(0, 3).map((c) => (
          <div key={c.ref} className="lr">
            <IconSpark />
            <span className="grow trunc">{c.card.title}</span>
            <span className="sep">|</span>
            <span className="mono-s muted">{c.board.name}</span>
            <span className="sep">|</span>
            <Link to={`${boardUrl(ws, c.board.path)}?card=${encodeURIComponent(c.card.file)}`} className="link">
              [View ↗]
            </Link>
          </div>
        ))}
      </div>
    </Card>
  )
}
