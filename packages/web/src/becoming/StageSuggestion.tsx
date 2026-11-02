import { Button } from '../components/Button'
import { identityName, STAGE_LABEL, suggestionText } from '../helpers/becoming'
import { capitalize } from '../helpers/format'
import { IconSpark } from '../icons'
import type { Identity, StageProgress } from '../types/becoming'

/** "Writer is ready for Sticking": Zync suggests, the user moves it. */
export function StageSuggestion({
  identity,
  progress,
  onAccept,
  onDismiss,
}: {
  identity: Identity
  progress: StageProgress
  onAccept: () => void
  onDismiss: () => void
}) {
  if (!progress.suggest) return null
  const name = identityName(identity.statement)
  return (
    <div className="suggest">
      <span className="small" style={{ fontSize: 13 }}>
        <IconSpark size={11} style={{ verticalAlign: -1 }} />{' '}
        <b style={{ fontWeight: 600 }}>
          {capitalize(name)} is ready for {STAGE_LABEL[progress.suggest]}
        </b>{' '}
        — {suggestionText(progress)}
      </span>
      <div className="row g6">
        <Button variant="primary" size="sm" onClick={onAccept}>
          Accept
        </Button>
        <Button size="sm" style={{ border: '1px dashed var(--sage-2)' }} onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
