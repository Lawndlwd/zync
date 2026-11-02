import { Link } from 'react-router'

import { keptByGuards, progressText, signalText, stripCounts } from '../helpers/becoming'
import { IconMinusCircle, IconShield } from '../icons'
import type { TodayRow } from '../types/becoming'
import { HeatStrip } from './HeatStrip'
import { StageSuggestion } from './StageSuggestion'
import { VoteCircle } from './VoteCircle'

/** One identity on the Becoming board: today's vote, four weeks of votes, how far the next stage is. */
export function IdentityCard({
  row,
  to,
  selected,
  onAccept,
  onDismiss,
}: {
  row: TodayRow
  to: string
  selected: boolean
  onAccept: () => void
  onDismiss: () => void
}) {
  const { identity, progress, strip, vote } = row
  const counts = stripCounts(strip)
  const guard = keptByGuards(identity) ? identity.guards[0] : undefined
  const source = guard ? 'guard' : identity.signals[0] ? signalText(identity.signals[0]) : 'by hand'
  return (
    <div className={`icard${selected ? ' sel' : ''}`}>
      <div className="row between">
        {guard ? (
          <span className="mono-s muted row g6">
            <IconShield size={12} sw={1.5} />
            Guard · from {guard.from}
          </span>
        ) : (
          <span className={`mono-s row g6${vote ? '' : ' muted'}`}>
            <VoteCircle vote={vote} size={12} />
            Today · {vote ? vote.kind : row.manual ? 'open' : 'waiting'}
          </span>
        )}
        {row.missedYesterday && !vote ? (
          <span className="mark">
            <IconMinusCircle />
            missed yesterday
          </span>
        ) : (
          <span className="mono-s muted">{row.manual ? 'manual' : 'auto'}</span>
        )}
      </div>
      <Link className="istmt icard-link" to={to}>
        {identity.statement}
      </Link>
      <span className="small muted">
        {identity.action}
        {identity.small ? ` · small: ${identity.small.toLowerCase()}` : ''}
      </span>
      <HeatStrip cells={strip} />
      <div className="row between mono-s g8">
        <span>
          {guard ? `${counts.votes} / ${counts.days} evenings` : `${counts.votes} votes / ${counts.days} days`}
        </span>
        <span className="muted trunc">{source}</span>
      </div>
      {progress.suggest ? (
        <StageSuggestion identity={identity} progress={progress} onAccept={onAccept} onDismiss={onDismiss} />
      ) : (
        <span className="small muted" style={{ fontSize: 12.5 }}>
          {progressText(progress, identity)}
        </span>
      )}
    </div>
  )
}
