import { Button } from '../components/Button'
import type { MirrorChange } from '../types/becoming'

/** The one change the Mirror suggests for next week, applied in one click. */
export function OneChange({
  change,
  next,
  busy,
  onApply,
}: {
  change: MirrorChange
  next: string
  busy: boolean
  onApply: () => void
}) {
  return (
    <section className="card hero one-change">
      <div className="col g8 grow">
        <span className="mono-s" style={{ opacity: 0.75 }}>
          One change for {next}
        </span>
        <span className="h2" style={{ color: 'var(--on-accent)' }}>
          {change.label}
        </span>
        {change.detail && (
          <span className="small" style={{ opacity: 0.8 }}>
            {change.detail}
          </span>
        )}
      </div>
      <div className="col g8" style={{ alignItems: 'flex-end' }}>
        {change.applied ? (
          <span className="mono-s">✓ Applied</span>
        ) : (
          <Button
            size="lg"
            busy={busy}
            style={{ background: 'var(--accent-soft)', color: 'var(--on-soft)' }}
            onClick={onApply}
          >
            Apply
          </Button>
        )}
        {change.alternative && !change.applied && (
          <span className="small" style={{ color: 'var(--on-accent)', opacity: 0.8 }}>
            [or] {change.alternative}
          </span>
        )}
      </div>
    </section>
  )
}
