import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { SaveStatus } from '../components/SaveStatus'
import { TextArea } from '../components/TextArea'
import { dateTimeLabel } from '../helpers/dates'
import { errorMessage, plural } from '../helpers/format'
import {
  clockLabel,
  DEFAULT_REST,
  elapsedSeconds,
  moveItem,
  setProgress,
  volumeLabel,
  volumeOf,
  workoutExerciseOf,
} from '../helpers/training'
import { trainingUrl } from '../helpers/urls'
import { useNow } from '../hooks/useNow'
import { useRestTimer } from '../hooks/useRestTimer'
import { useWorkoutEditor } from '../hooks/useWorkoutEditor'
import { IconPlus } from '../icons'
import type { FinishResult, Units, Workout, WorkoutExercise } from '../types/training'
import { ExercisePickerPanel } from './ExercisePickerPanel'
import { FinishSummary } from './FinishSummary'
import { RestBar } from './RestBar'
import { WorkoutExerciseBlock } from './WorkoutExerciseBlock'

const REST_STEP = 15

/**
 * A workout being logged: the clock, the sets, the rest timer between them. Every change is saved
 * to the workout's file after a pause; "Finish" closes it and shows the records and votes.
 */
export function WorkoutEditor({ ws, workout, units }: { ws: string; workout: Workout; units: Units }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const editor = useWorkoutEditor(ws, workout)
  const rest = useRestTimer()
  const now = useNow(1000)
  const [result, setResult] = useState<FinishResult | null>(null)
  const [finishing, setFinishing] = useState(false)
  const { draft } = editor
  const finished = workout.endedAt !== undefined
  const adding = params.get('add') === '1'
  const end = workout.endedAt ? Date.parse(workout.endedAt) : now.getTime()
  const progress = setProgress(draft.exercises)

  const setExercises = (exercises: WorkoutExercise[]) => editor.change({ ...draft, exercises })
  const setAt = (i: number, item: WorkoutExercise) => setExercises(draft.exercises.map((e, j) => (j === i ? item : e)))

  const finish = async () => {
    const left = progress.total - progress.done
    if (left > 0) {
      const ok = await confirm({
        title: 'Finish this workout?',
        body: `${plural(left, 'set')} not ticked off won’t count.`,
        confirmLabel: 'Finish',
      })
      if (!ok) return
    }
    setFinishing(true)
    try {
      await editor.flush()
      const done = await api.finishWorkout(ws, workout.file)
      rest.skip()
      setResult(done)
      await qc.invalidateQueries({ queryKey: ['training', ws] })
      await qc.invalidateQueries({ queryKey: ['becoming', ws] })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setFinishing(false)
    }
  }

  const discard = async () => {
    const ok = await confirm({
      title: finished ? 'Delete this workout?' : 'Discard this workout?',
      body: `${workout.name} and every set logged in it are deleted.`,
      confirmLabel: finished ? 'Delete' : 'Discard',
      destructive: true,
    })
    if (!ok) return
    editor.cancel()
    try {
      await api.deleteWorkout(ws, workout.file)
      await qc.invalidateQueries({ queryKey: ['training', ws] })
      void navigate(trainingUrl(ws))
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  if (result)
    return (
      <div className="page">
        <FinishSummary ws={ws} result={result} units={units} />
      </div>
    )

  return (
    <div className={`board-view${adding ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g16" style={{ padding: '28px 32px 32px' }}>
          <div className="row between">
            <span className="mono muted">{ws} / training / workout</span>
            <SaveStatus state={editor.saving ? 'saving' : 'saved'} />
          </div>
          <div className="row between g16 wrap" style={{ alignItems: 'flex-end' }}>
            <div className="col g8">
              <h1 className="display" style={{ fontSize: 40 }}>
                {workout.name}
              </h1>
              <span className="mono-s muted">
                {finished ? 'Finished' : 'Started'} {dateTimeLabel(new Date(finished ? end : workout.startedAt))}
              </span>
            </div>
            <div className="row g8">
              <Button onClick={() => void discard()}>{finished ? 'Delete' : 'Discard'}</Button>
              {!finished && (
                <Button variant="primary" busy={finishing} onClick={() => void finish()}>
                  [✓] Finish
                </Button>
              )}
            </div>
          </div>

          <div className="tr-stats">
            <div className="tile">
              <span className="mono-s muted">{finished ? 'Duration' : 'Elapsed'}</span>
              <span className="tn">{clockLabel(elapsedSeconds(workout.startedAt, end))}</span>
            </div>
            <div className="tile">
              <span className="mono-s muted">Volume</span>
              <span className="tn">{volumeLabel(volumeOf(draft.exercises), units)}</span>
            </div>
            <div className="tile">
              <span className="mono-s muted">Sets</span>
              <span className="tn">
                {progress.done}
                <span className="muted"> of {progress.total}</span>
              </span>
            </div>
          </div>

          {rest.running && (
            <RestBar left={rest.left} total={rest.total} onAdd={() => rest.add(REST_STEP)} onSkip={rest.skip} />
          )}

          {draft.exercises.length === 0 && <p className="small muted">No exercises yet — add one from the library.</p>}
          {draft.exercises.map((e, i) => (
            <WorkoutExerciseBlock
              // oxlint-disable-next-line react/no-array-index-key -- the same exercise may appear twice; moving remounts on purpose
              key={`${e.exercise}:${i}`}
              item={e}
              previous={workout.previous[e.exercise]}
              units={units}
              first={i === 0}
              last={i === draft.exercises.length - 1}
              onChange={(item) => setAt(i, item)}
              onMove={(delta) => setExercises(moveItem(draft.exercises, i, i + delta))}
              onRemove={() => setExercises(draft.exercises.filter((_, j) => j !== i))}
              onSetDone={() => {
                if (!finished) rest.start(e.rest ?? DEFAULT_REST)
              }}
            />
          ))}
          <Button style={{ alignSelf: 'flex-start' }} onClick={() => setParams({ add: '1' })}>
            <IconPlus size={12} /> Add exercise
          </Button>

          <div className="col g6">
            <span className="flabel">Notes</span>
            <TextArea
              autoGrow={240}
              rows={3}
              value={draft.notes}
              placeholder="How did it go?"
              aria-label="Workout notes"
              onChange={(e) => editor.change({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>
      </div>
      {adding && (
        <ExercisePickerPanel
          ws={ws}
          onPick={(ex) => {
            setExercises([...draft.exercises, workoutExerciseOf(ex)])
            setParams({})
          }}
          onClose={() => setParams({})}
        />
      )}
    </div>
  )
}
