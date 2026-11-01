import { Toggle } from '../components/Toggle'
import {
  EQUIPMENT_LABEL,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  minutesLabel,
  type ProfileDraft,
  TRAINING_IDENTITY,
} from '../helpers/training'

/** Setup, last step: the answers at a glance, and whether training becomes a Becoming identity. */
export function SetupFinish({
  d,
  identity,
  identityExists,
  onIdentity,
}: {
  d: ProfileDraft
  identity: boolean
  identityExists: boolean
  onIdentity: (on: boolean) => void
}) {
  return (
    <div className="col g16">
      <div className="kv" style={{ gridTemplateColumns: '120px minmax(0, 1fr)' }}>
        <span className="k">goal</span>
        <span>
          {d.goal ? GOAL_LABEL[d.goal] : '—'}
          {d.experience ? ` · ${EXPERIENCE_LABEL[d.experience]}` : ''}
        </span>
        <span className="k">equipment</span>
        <span>{d.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ') || '—'}</span>
        <span className="k">schedule</span>
        <span>
          {d.daysPerWeek ?? '—'} days a week
          {d.sessionMinutes ? ` · ${minutesLabel(d.sessionMinutes)}` : ''}
        </span>
        {d.injuries.trim() && (
          <>
            <span className="k">limits</span>
            <span>{d.injuries.trim()}</span>
          </>
        )}
        <span className="k">units</span>
        <span>{d.units}</span>
      </div>
      <div className="softrule" style={{ alignItems: 'center' }}>
        <Toggle
          checked={identity && !identityExists}
          disabled={identityExists}
          label="Also make it a Becoming identity"
          onChange={onIdentity}
        />
        <span className="grow">
          {identityExists ? (
            <>You already have an identity that counts workouts — each one you finish votes for it.</>
          ) : (
            <>
              Also make it a Becoming identity: <b>“{TRAINING_IDENTITY}”</b>. Every workout you finish counts as a vote
              — a full one from 20 minutes.
            </>
          )}
        </span>
      </div>
    </div>
  )
}
