import { Link } from 'react-router'

import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { identityName } from '../helpers/becoming'
import { capitalize, plural } from '../helpers/format'
import {
  clockLabel,
  deltaLabel,
  elapsedSeconds,
  setProgress,
  volumeLabel,
  volumeOf,
  weightLabel,
} from '../helpers/training'
import { identityUrl, trainingUrl } from '../helpers/urls'
import { useIdentities } from '../hooks/useIdentities'
import type { FinishResult, Units } from '../types/training'

/** After "Finish": the session in numbers, the records it set and the Becoming votes it cast. */
export function FinishSummary({ ws, result, units }: { ws: string; result: FinishResult; units: Units }) {
  const identities = useIdentities(ws)
  const { workout, prs, votes } = result
  const progress = setProgress(workout.exercises)
  const end = workout.endedAt ? Date.parse(workout.endedAt) : Date.parse(workout.startedAt)
  const statement = (file: string) => identities.data?.find((i) => i.file === file)?.statement ?? file

  return (
    <div className="col g16" style={{ maxWidth: 720 }}>
      <section className="card hero col g12" aria-label="Workout finished">
        <div className="card-h">
          <span className="t">Workout done · {workout.name}</span>
          <span className="m">{clockLabel(elapsedSeconds(workout.startedAt, end))}</span>
        </div>
        <div className="row g24 wrap">
          <span className="col g4">
            <span className="num-m">{volumeLabel(volumeOf(workout.exercises), units)}</span>
            <span className="mono-s">volume</span>
          </span>
          <span className="col g4">
            <span className="num-m">{progress.done}</span>
            <span className="mono-s">{progress.done === 1 ? 'set' : 'sets'} done</span>
          </span>
          <span className="col g4">
            <span className="num-m">{prs.length}</span>
            <span className="mono-s">{prs.length === 1 ? 'record' : 'records'}</span>
          </span>
        </div>
      </section>

      {prs.length > 0 && (
        <Card title="New records" meta="estimated one-rep max">
          <div className="col">
            {prs.map((p) => (
              <div key={p.exercise} className="lr">
                <span className="grow trunc">{p.name}</span>
                <span className="small muted">
                  {weightLabel(p.kg, units)} × {p.reps}
                </span>
                <span className="mono-s">
                  e1RM {weightLabel(p.e1rm, units)}
                  {p.previousE1rm === undefined ? ' · first' : ` · ${deltaLabel(p.e1rm - p.previousE1rm, units)}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {votes.length > 0 && (
        <Card title="Becoming" meta={plural(votes.length, 'vote')}>
          <div className="col">
            {votes.map((v) => (
              <Link key={v.identity} to={identityUrl(ws, v.identity)} className="lr row-link">
                <span className="grow trunc">{capitalize(identityName(statement(v.identity)))}</span>
                <span className="label">{v.kind} vote</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="row g8">
        <ButtonLink variant="primary" to={trainingUrl(ws)}>
          Back to Training
        </ButtonLink>
        <ButtonLink to={trainingUrl(ws, 'log')}>Open the log</ButtonLink>
      </div>
    </div>
  )
}
