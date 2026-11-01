import { useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { useConfirm, useToast } from '../components/Dialog'
import { IconButton } from '../components/IconButton'
import { dateTimeLabel } from '../helpers/dates'
import { errorMessage } from '../helpers/format'
import { clockLabel, elapsedSeconds, setProgress, setsText, volumeLabel, volumeOf } from '../helpers/training'
import { workoutUrl } from '../helpers/urls'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { useWorkout } from '../hooks/useWorkout'
import { IconCross } from '../icons'
import type { Units } from '../types/training'

/** A logged workout beside the Log, read-only; open its page to change it. */
export function WorkoutPanel({
  ws,
  file,
  units,
  onClose,
}: {
  ws: string
  file: string
  units: Units
  onClose: () => void
}) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const { data: w, error, isLoading } = useWorkout(ws, file)
  usePanelEscape(onClose)

  const remove = async () => {
    if (!w) return
    const ok = await confirm({
      title: 'Delete this workout?',
      body: (
        <>
          <b>{w.name}</b> of {dateTimeLabel(new Date(w.startedAt))} and its page{' '}
          <span className="mono-s">Training/Log/{w.file}</span> are deleted.
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await api.deleteWorkout(ws, w.file)
      onClose()
      toast(`Deleted “${w.name}”`, 'quiet')
      await qc.invalidateQueries({ queryKey: ['training', ws] })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  const progress = w ? setProgress(w.exercises) : null
  const seconds = w?.endedAt ? elapsedSeconds(w.startedAt, Date.parse(w.endedAt)) : undefined

  return (
    <aside className="panel card-panel" aria-label={`Workout: ${w?.name ?? file}`}>
      <div className="panel-h">
        <span className="mono muted trunc">Training / Log</span>
        <span className="grow" />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        {error && <p className="small danger-t">{error.message}</p>}
        {isLoading && <div className="skel" style={{ height: 240 }} />}
        {w && progress && (
          <div className="col g20">
            <div className="col g6">
              <h2 className="h2">{w.name}</h2>
              <span className="mono-s muted">
                {dateTimeLabel(new Date(w.startedAt))} · {seconds === undefined ? 'in progress' : clockLabel(seconds)} ·{' '}
                {progress.done}/{progress.total} sets · {volumeLabel(volumeOf(w.exercises), units)}
              </span>
            </div>
            <div className="col">
              {w.exercises.map((e, i) => (
                // oxlint-disable-next-line react/no-array-index-key -- read-only list; an exercise may appear twice
                <div key={`${e.exercise}:${i}`} className="lr" style={{ alignItems: 'flex-start' }}>
                  <span className="grow col g4" style={{ minWidth: 0 }}>
                    <span>{e.name}</span>
                    <span className="small muted">{setsText(e.sets, units)}</span>
                    {e.note && <span className="small muted">“{e.note}”</span>}
                  </span>
                </div>
              ))}
            </div>
            {w.notes.trim() && (
              <div className="col g6">
                <span className="flabel">Notes</span>
                <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {w.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="row between panel-f">
        <Button size="sm" disabled={!w} onClick={() => void remove()}>
          Delete
        </Button>
        {w && (
          <ButtonLink size="sm" variant="primary" to={workoutUrl(ws, w.file)}>
            {w.endedAt ? 'Edit' : 'Resume'}
          </ButtonLink>
        )}
      </div>
    </aside>
  )
}
