import { Link } from 'react-router'

import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { ymd } from '../helpers/dates'
import { plural } from '../helpers/format'
import {
  clockLabel,
  elapsedSeconds,
  routineSummary,
  setProgress,
  volumeLabel,
  weekCells,
  weekdayOf,
} from '../helpers/training'
import { routineUrl, trainingUrl, workoutUrl } from '../helpers/urls'
import { useNow } from '../hooks/useNow'
import { useRoutines } from '../hooks/useRoutines'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { useTrainingToday } from '../hooks/useTrainingToday'
import type { Units } from '../types/training'
import { BodyWeightLog } from './BodyWeightLog'
import { WeekStrip } from './WeekStrip'

/** Today: a workout to resume or today's routine to start, the week so far, and body weight. */
export function TodayTab({ ws, units }: { ws: string; units: Units }) {
  const now = useNow(1000)
  const today = useTrainingToday(ws)
  const routines = useRoutines(ws)
  const starter = useStartWorkout(ws)
  const date = ymd(now)

  if (today.error) return <p className="lede danger-t">{today.error.message}</p>
  if (!today.data) return <div className="skel" style={{ height: 320 }} />
  const { planned, active, week, streak } = today.data
  const list = routines.data ?? []
  const others = list.filter((r) => r.file !== planned?.file)
  const progress = active ? setProgress(active.exercises) : null

  return (
    <div className="tr-today">
      <div className="col g16">
        {active && progress && (
          <section className="card hero col g12" aria-label="Workout in progress">
            <div className="card-h">
              <span className="t">In progress · {active.name}</span>
              <span className="m">{clockLabel(elapsedSeconds(active.startedAt, now.getTime()))}</span>
            </div>
            <span className="small">
              {progress.done} of {progress.total} sets done
            </span>
            <div>
              <ButtonLink variant="soft" to={workoutUrl(ws, active.file)}>
                [→] Resume workout
              </ButtonLink>
            </div>
          </section>
        )}

        {planned ? (
          <Card title={`Today · ${weekdayOf(date)}`} meta={routineSummary(planned)}>
            <div className="col g12">
              <Link to={routineUrl(ws, planned.file)} className="h3">
                {planned.name}
              </Link>
              <div className="col">
                {planned.exercises.map((e, i) => (
                  // oxlint-disable-next-line react/no-array-index-key -- a routine may list the same exercise twice
                  <div key={`${e.exercise}:${i}`} className="lr">
                    <span className="grow trunc">{e.name}</span>
                    <span className="mono-s muted">{e.scheme}</span>
                  </div>
                ))}
              </div>
              {!active && (
                <div className="row g8">
                  <Button variant="primary" busy={starter.busy} onClick={() => void starter.start(planned.file)}>
                    [▶] Start {planned.name}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card title={`Today · ${weekdayOf(date)}`} meta="rest day">
            <div className="col g12">
              <p className="small muted" style={{ margin: 0 }}>
                No routine is planned for today.{' '}
                {list.length === 0 ? 'Write your first routine, or start an empty workout.' : 'Train anyway?'}
              </p>
              {!active && (
                <div className="row g8 wrap">
                  <Button busy={starter.busy} onClick={() => void starter.start()}>
                    [+] Empty workout
                  </Button>
                  {list.length === 0 && <ButtonLink to={trainingUrl(ws, 'routines')}>Routines</ButtonLink>}
                </div>
              )}
            </div>
          </Card>
        )}

        {!active && others.length > 0 && (
          <Card title="Other routines" meta={plural(others.length, 'routine')}>
            <div className="col">
              {others.map((r) => (
                <div key={r.file} className="lr">
                  <Link to={routineUrl(ws, r.file)} className="grow col g4" style={{ minWidth: 0 }}>
                    <span className="trunc">{r.name}</span>
                    <span className="mono-s muted trunc">{routineSummary(r)}</span>
                  </Link>
                  <Button size="sm" busy={starter.busy} onClick={() => void starter.start(r.file)}>
                    Start
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="col g16">
        <Card title="This week" meta={streak > 0 ? `${plural(streak, 'day')} streak` : 'no streak yet'}>
          <div className="col g16">
            <WeekStrip cells={weekCells(week.days, date, list)} />
            <div className="tr-stats">
              <div className="tile">
                <span className="mono-s muted">Sessions</span>
                <span className="tn">
                  {week.done}
                  <span className="muted">/{week.planned}</span>
                </span>
              </div>
              <div className="tile">
                <span className="mono-s muted">Volume</span>
                <span className="tn">{volumeLabel(week.volumeKg, units)}</span>
              </div>
              <div className="tile">
                <span className="mono-s muted">Streak</span>
                <span className="tn">{streak}</span>
              </div>
            </div>
          </div>
        </Card>
        <BodyWeightLog ws={ws} units={units} />
      </div>
    </div>
  )
}
