import { Link } from 'react-router'

import { IconButton } from '../components/IconButton'
import { shortDate } from '../helpers/becoming'
import { setsText, weightLabel } from '../helpers/training'
import { workoutUrl } from '../helpers/urls'
import { useExercise } from '../hooks/useExercise'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconCross } from '../icons'
import type { Units } from '../types/training'

/** One exercise beside the list: how to do it, the best set and every time it was logged. */
export function ExercisePanel({
  ws,
  id,
  units,
  onClose,
}: {
  ws: string
  id: string
  units: Units
  onClose: () => void
}) {
  const { data, error, isLoading } = useExercise(ws, id)
  usePanelEscape(onClose)
  const ex = data?.exercise

  return (
    <aside className="panel card-panel" aria-label={`Exercise: ${ex?.name ?? id}`}>
      <div className="panel-h">
        <span className="mono muted trunc">Training / {ex?.custom ? 'Custom exercise' : 'Exercise'}</span>
        <span className="grow" />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        {error && <p className="small danger-t">{error.message}</p>}
        {isLoading && <div className="skel" style={{ height: 240 }} />}
        {data && ex && (
          <div className="col g20">
            <div className="col g8">
              <h2 className="h2">{ex.name}</h2>
              <div className="row g6 wrap">
                <span className="label">{ex.muscleGroup}</span>
                <span className="label alt">{ex.equipment}</span>
                {ex.target && <span className="label alt">target · {ex.target}</span>}
              </div>
              {ex.secondary.length > 0 && <span className="small muted">Also works {ex.secondary.join(', ')}</span>}
            </div>

            {(ex.gif ?? ex.image) && (
              <img className="tr-gif" src={ex.gif ?? ex.image} alt={`${ex.name}, demonstrated`} />
            )}

            <section className="col g8" aria-label="Your best">
              <span className="flabel">Your best</span>
              {data.best ? (
                <div className="row g16 wrap">
                  <span className="num-m">{weightLabel(data.best.kg, units)}</span>
                  <span className="small muted">
                    × {data.best.reps} · e1RM {weightLabel(data.best.e1rm, units)}
                  </span>
                </div>
              ) : (
                <span className="small muted">Not logged yet.</span>
              )}
            </section>

            {ex.instructions.length > 0 && (
              <section className="col g8" aria-label="How to">
                <span className="flabel">How to</span>
                <ol className="tr-steps-list small">
                  {ex.instructions.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            )}

            <section className="col g4" aria-label="History">
              <span className="flabel">History</span>
              {data.history.length === 0 && <span className="small muted">Nothing logged yet.</span>}
              {data.history.map((h) => (
                <Link key={h.workout} to={workoutUrl(ws, h.workout)} className="lr row-link">
                  <span className="mono-s muted" style={{ width: 64, flexShrink: 0 }}>
                    {shortDate(h.date)}
                  </span>
                  <span className="grow small trunc">{setsText(h.sets, units)}</span>
                </Link>
              ))}
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}
