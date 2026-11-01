import { Link } from 'react-router'

import { VoteCircle } from '../becoming/VoteCircle'
import { SegButtons } from '../components/SegButtons'
import { rowChip, slotText, STAGE_LABEL, targetSub, targetText } from '../helpers/becoming'
import { IconBolt, IconClock, IconMinusCircle, IconShield } from '../icons'
import type { TodayRow } from '../types/becoming'

/** One identity on the Overview tile: vote, statement, today's target, its slot, the evidence. */
export function BecomingRow({
  row,
  first,
  onVote,
  to,
}: {
  row: TodayRow
  first: boolean
  onVote: (kind: 'full' | 'small') => void
  /** The identity's page. */
  to: string
}) {
  const chip = rowChip(row)
  const missed = row.missedYesterday && !row.vote
  const target = targetText(row)
  return (
    <div className={`idrow${first && missed ? ' first' : ''}`}>
      <VoteCircle vote={row.vote} />
      <div className="col g4" style={{ minWidth: 0 }}>
        <Link className="stmt trunc" to={to}>
          {row.identity.statement}
        </Link>
        <span className="row g8">
          <span className="mono-s muted">{STAGE_LABEL[row.identity.stage]}</span>
          {missed && (
            <span className="mark">
              <IconMinusCircle />
              missed yesterday
            </span>
          )}
        </span>
      </div>
      <div className="col g4" style={{ minWidth: 0 }}>
        <span className="tgt">{target}</span>
        <span className="small muted" style={{ fontSize: 12.5 }}>
          {targetSub(row)}
        </span>
      </div>
      <div className="col g4" style={{ minWidth: 0 }}>
        {row.slot ? (
          <>
            <span className="slot">
              <IconClock size={12} sw={1.6} />
              {slotText(row.slot)}
            </span>
            {row.slot.movedFrom && (
              <span className="slot">
                <span className="note">moved from {row.slot.movedFrom}</span>
              </span>
            )}
          </>
        ) : (
          <span className="slot">
            <span className="note">no free slot today</span>
          </span>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', minWidth: 0 }}>
        {chip.tone === 'vote' ? (
          <SegButtons
            label={`Vote for ${row.identity.statement}`}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'small', label: 'Small' },
            ]}
            onPick={onVote}
          />
        ) : (
          <span className={`evid${chip.tone === 'evid' ? '' : ` ${chip.tone}`}`} title={chip.text}>
            {chip.tone === 'guard' ? <IconShield /> : <IconBolt filled={chip.tone === 'evid'} />}
            {chip.text}
          </span>
        )}
      </div>
    </div>
  )
}
