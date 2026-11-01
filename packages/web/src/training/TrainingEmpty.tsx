import { ButtonLink } from '../components/ButtonLink'
import { trainingUrl } from '../helpers/urls'

/** Training before the setup: what it does, and the two ways in. */
export function TrainingEmpty({ ws }: { ws: string }) {
  return (
    <section className="card col g16" aria-label="Set up Training">
      <div className="col g8">
        <span className="h3">Set up Training</span>
        <p className="small muted" style={{ margin: 0, maxWidth: 560 }}>
          Tell Zync your goal, the equipment you have and how often you can train. The AI builds your routines from real
          exercises — or you write them yourself. Every workout becomes a page in{' '}
          <span className="mono-s">Training/</span> and can count as a vote for who you’re becoming.
        </p>
      </div>
      <div className="row g8 wrap">
        <ButtonLink variant="primary" to={trainingUrl(ws, 'setup')}>
          [→] Start setup
        </ButtonLink>
        <ButtonLink to={trainingUrl(ws, 'routines')}>I’ll build routines myself</ButtonLink>
      </div>
    </section>
  )
}
