import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { wsUrl } from '../helpers/urls'
import { useBecomingInterview } from '../hooks/useBecomingInterview'

/** No identities yet: one sentence to the AI is enough to start. */
export function BecomingEmpty({ ws }: { ws: string }) {
  const interview = useBecomingInterview(ws)
  return (
    <div className="row g32 wrap" style={{ padding: '20px 0 4px', alignItems: 'center' }}>
      <div className="col g12 grow" style={{ minWidth: 260 }}>
        <h3 className="h2">Tell the AI who you want to become.</h3>
        <p className="small muted" style={{ margin: 0, maxWidth: 520, fontSize: 14.5 }}>
          One sentence is enough — “I am a writer”. Zync turns it into an identity page, picks the evidence it can see
          (files, cards, calendar) and suggests a 2-minute version for heavy days.
        </p>
        <div className="row g8">
          <Button variant="primary" busy={interview.busy} onClick={() => void interview.start()}>
            [↗] Start with the AI
          </Button>
          <ButtonLink to={`${wsUrl(ws, 'becoming')}?new=1`}>[+] Write one myself</ButtonLink>
        </div>
      </div>
      <div className="col g6" style={{ width: 320 }}>
        <span className="flabel">The AI will ask</span>
        <span className="lr small">Who do you want to be in a year?</span>
        <span className="lr small">What does a tiny vote for that look like?</span>
        <span className="lr small">What would Zync see when you do it?</span>
      </div>
    </div>
  )
}
