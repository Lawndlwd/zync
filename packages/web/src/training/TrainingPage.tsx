import { useNavigate, useSearchParams } from 'react-router'

import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { Segmented } from '../components/Segmented'
import { dateTimeLabel } from '../helpers/dates'
import { trainingUrl } from '../helpers/urls'
import { useNow } from '../hooks/useNow'
import { useRoutines } from '../hooks/useRoutines'
import { useTrainingPlan } from '../hooks/useTrainingPlan'
import { useTrainingProfile } from '../hooks/useTrainingProfile'
import { useShell } from '../shell/ShellContext'
import type { TrainingTab } from '../types/training'
import { CustomExerciseDraft } from './CustomExerciseDraft'
import { ExercisePanel } from './ExercisePanel'
import { LibraryTab } from './LibraryTab'
import { LogTab } from './LogTab'
import { ProgressTab } from './ProgressTab'
import { RoutinePanel } from './RoutinePanel'
import { RoutinesTab } from './RoutinesTab'
import { TodayTab } from './TodayTab'
import { TrainingEmpty } from './TrainingEmpty'
import { WorkoutPanel } from './WorkoutPanel'

type Tab = 'today' | Exclude<TrainingTab, 'setup'>

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'routines', label: 'Routines' },
  { value: 'log', label: 'Log' },
  { value: 'progress', label: 'Progress' },
  { value: 'library', label: 'Library' },
]

/**
 * Training: Today, routines, the log, progress and the exercise library. Routines, workouts and
 * exercises open in a side panel (`?open=`, `?exercise=`), never a modal.
 */
export function TrainingPage({ tab }: { tab: Tab }) {
  const { ws } = useShell()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const profile = useTrainingProfile(ws)
  const routines = useRoutines(ws)
  const plan = useTrainingPlan(ws)
  const units = profile.data?.units ?? 'kg'
  const openFile = params.get('open') ?? ''
  const exerciseId = params.get('exercise') ?? ''
  const creatingExercise = params.get('new') === 'exercise'
  const openRoutine = tab === 'routines' ? routines.data?.find((r) => r.file === openFile) : undefined
  const close = () => setParams({})

  const panel = (() => {
    if (exerciseId) return <ExercisePanel key={exerciseId} ws={ws} id={exerciseId} units={units} onClose={close} />
    if (openRoutine)
      return (
        <RoutinePanel
          key={openRoutine.file}
          ws={ws}
          routine={openRoutine}
          units={units}
          onRenamed={(file) => setParams({ open: file })}
          onClose={close}
        />
      )
    if (tab === 'log' && openFile)
      return <WorkoutPanel key={openFile} ws={ws} file={openFile} units={units} onClose={close} />
    if (tab === 'library' && creatingExercise)
      return <CustomExerciseDraft ws={ws} onCreated={(id) => setParams({ exercise: id })} onClose={close} />
    return null
  })()

  const empty = tab === 'today' && profile.data === null

  return (
    <div className={`board-view${panel ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g20" style={{ padding: '28px 32px 32px' }}>
          <div className="col g12">
            <div className="row between">
              <span className="mono muted">{ws} / training</span>
              <span className="mono muted">{dateTimeLabel(now)}</span>
            </div>
            <div className="row between g16 wrap" style={{ alignItems: 'flex-end' }}>
              <div className="col g8">
                <h1 className="display" style={{ fontSize: 44 }}>
                  Training
                </h1>
                <p className="lede" style={{ fontSize: 16 }}>
                  Your routines, every set you log, and how you get stronger.
                </p>
              </div>
              {profile.data && (
                <div className="row g8 wrap">
                  <ButtonLink to={trainingUrl(ws, 'setup')}>[⚙] Setup</ButtonLink>
                  <Button busy={plan.busy} onClick={() => void plan.start()}>
                    [↗] Plan with AI
                  </Button>
                </div>
              )}
            </div>
            <Segmented
              label="Training"
              value={tab}
              options={TABS}
              onChange={(t) => void navigate(t === 'today' ? trainingUrl(ws) : trainingUrl(ws, t))}
            />
          </div>

          {profile.error && <p className="lede danger-t">{profile.error.message}</p>}
          {tab === 'today' && profile.isLoading && <div className="skel" style={{ height: 320 }} />}
          {empty && <TrainingEmpty ws={ws} />}
          {tab === 'today' && profile.data && <TodayTab ws={ws} units={units} />}
          {tab === 'routines' && <RoutinesTab ws={ws} openFile={openFile} />}
          {tab === 'log' && <LogTab ws={ws} units={units} openFile={openFile} />}
          {tab === 'progress' && <ProgressTab ws={ws} units={units} />}
          {tab === 'library' && <LibraryTab ws={ws} selected={exerciseId} />}
        </div>
      </div>
      {panel}
    </div>
  )
}
