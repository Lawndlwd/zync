import type { DayVote } from '../types/becoming'

/** Empty (not voted), half (the 2-minute version) or full with a check. */
export function VoteCircle({ vote, size = 20 }: { vote?: DayVote | undefined; size?: number }) {
  const label = vote ? `${vote.kind} vote` : 'not voted yet'
  return (
    <span className="vc" role="img" aria-label={label} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        {vote?.kind === 'full' ? (
          <>
            <circle cx="10" cy="10" r="9" fill="currentColor" />
            <path d="M6 10.3l2.6 2.6 5.3-5.5" fill="none" stroke="var(--on-accent)" strokeWidth="1.9" />
          </>
        ) : (
          <>
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {vote?.kind === 'small' && <path d="M10 2a8 8 0 010 16z" fill="currentColor" />}
          </>
        )}
      </svg>
    </span>
  )
}
