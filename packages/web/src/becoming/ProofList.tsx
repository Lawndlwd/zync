import { shortDate } from '../helpers/becoming'
import type { ProofLine } from '../types/becoming'

const SHOWN = 12

/** The evidence Zync appended to the page, newest first. */
export function ProofList({ proof }: { proof: ProofLine[] }) {
  return (
    <div className="col g4">
      <div className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
        <span className="flabel">Proof · appended by Zync</span>
        <span className="mono-s muted">
          {proof.length} {proof.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      {proof.length === 0 && (
        <span className="small muted" style={{ padding: '7px 0' }}>
          Nothing yet. Each vote — seen by Zync or cast by you — lands here.
        </span>
      )}
      {proof.slice(0, SHOWN).map((p) => (
        <div key={`${p.date}|${p.source}|${p.text}`} className="lr small" style={{ padding: '7px 0' }}>
          <span className="mono-s" style={{ width: 52, flexShrink: 0 }}>
            {shortDate(p.date)}
          </span>
          <span className="grow trunc">{p.text}</span>
          <span className="mono-s muted">{p.source}</span>
        </div>
      ))}
    </div>
  )
}
