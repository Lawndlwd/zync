import { Link } from 'react-router'

import { identityName } from '../helpers/becoming'
import { dayLabel } from '../helpers/dates'
import { plural } from '../helpers/format'
import { boardUrl, identityUrl, wsUrl } from '../helpers/urls'
import { useBecomingToday } from '../hooks/useBecomingToday'
import { useVote } from '../hooks/useVote'
import { IconBecoming, IconBoard } from '../icons'
import { BecomingEmpty } from './BecomingEmpty'
import { BecomingRow } from './BecomingRow'

/** "Becoming · Mon 28 Sep": today seen through the user's identities, on top of the Overview. */
export function BecomingTile({ ws, date }: { ws: string; date: string }) {
  const today = useBecomingToday(ws, date)
  const vote = useVote(ws)
  if (today.isLoading || today.error || !today.data) return null
  const { rows, day, oneCard } = today.data
  const voted = rows.filter((r) => r.vote).length
  const heavy = day.mode === 'heavy'
  const oneFor = oneCard && rows.find((r) => r.identity.file === oneCard.identity)?.identity
  return (
    <section className="card" style={{ padding: '18px 22px 20px' }} aria-label="Becoming today">
      <div
        className="row between g16 wrap"
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--line)', marginBottom: 6 }}
      >
        <div className="row g16 wrap">
          <span className="mono row g8">
            <IconBecoming size={14} />
            Becoming · {dayLabel(new Date(`${date}T00:00`))}
          </span>
          {rows.length > 0 && (
            <span className={`daymode${heavy ? '' : ' open'}`} title={day.reason}>
              <b>{heavy ? 'Heavy day' : 'Open day'}</b>
              <span>
                {day.meetings ? plural(day.meetings, 'meeting') : 'No meetings'} →{' '}
                {heavy ? 'small versions' : 'full versions'}
              </span>
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <div className="row g16">
            <span className="mono-s muted">
              {voted} of {rows.length} voted
            </span>
            <Link className="link" to={wsUrl(ws, 'becoming')}>
              [All identities ↗]
            </Link>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <BecomingEmpty ws={ws} />
      ) : (
        <>
          <div className="col">
            {rows.map((r, i) => (
              <BecomingRow
                key={r.identity.file}
                row={r}
                first={i === 0}
                to={identityUrl(ws, r.identity.file)}
                onVote={(kind) => void vote(r.identity.file, kind, 'tap', date)}
              />
            ))}
          </div>
          {oneCard && (
            <div className="onecard" style={{ marginTop: 10 }}>
              <span className="mono-s">The one card</span>
              <IconBoard size={14} />
              <span className="grow trunc" style={{ fontSize: 14.5 }}>
                <b style={{ fontWeight: 600 }}>{oneCard.title}</b>{' '}
                <span style={{ opacity: 0.75 }}>
                  → votes for {oneFor ? identityName(oneFor.statement) : 'you'} · board {oneCard.board}
                </span>
              </span>
              <Link className="link" style={{ color: 'var(--on-soft)' }} to={boardUrl(ws, oneCard.board)}>
                [Open card ↗]
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  )
}
