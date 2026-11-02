import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { IconButton } from '../components/IconButton'
import { PillToggle } from '../components/PillToggle'
import { SaveStatus } from '../components/SaveStatus'
import { TextArea } from '../components/TextArea'
import { TextInput } from '../components/TextInput'
import { TitleInput } from '../components/TitleInput'
import { errorMessage } from '../helpers/format'
import { moveItem, routineExerciseOf, TRAINING_DAYS, toggleDay } from '../helpers/training'
import { fileUrl } from '../helpers/urls'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { IconCross, IconFile, IconPlus } from '../icons'
import type { Routine, RoutineExercise, RoutinePatch, TrainingDay, Units } from '../types/training'
import { ExercisePicker } from './ExercisePicker'
import { RoutineExerciseEditor } from './RoutineExerciseEditor'

type Draft = { days: TrainingDay[]; folder: string; exercises: RoutineExercise[]; notes: string }

/** A routine's editor beside the list: every change is saved to its file after a pause. */
export function RoutinePanel({
  ws,
  routine,
  units,
  onRenamed,
  onClose,
}: {
  ws: string
  routine: Routine
  units: Units
  onRenamed: (file: string) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const starter = useStartWorkout(ws)
  const saver = useDebouncedSave<RoutinePatch>(600)
  const [name, setName] = useState(routine.name)
  const [draft, setDraft] = useState<Draft>({
    days: routine.days,
    folder: routine.folder ?? '',
    exercises: routine.exercises,
    notes: routine.notes,
  })
  const [adding, setAdding] = useState(false)
  const path = `Training/Routines/${routine.file}`

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['training', ws, 'routines'] })
    await qc.invalidateQueries({ queryKey: ['training', ws, 'today'] })
  }
  const save = async (patch: RoutinePatch) => {
    try {
      await api.updateRoutine(ws, routine.file, patch)
      await refresh()
    } catch (err) {
      toast(errorMessage(err), 'bad')
      throw err
    }
  }
  const change = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    saver.schedule(
      routine.file,
      { days: next.days, folder: next.folder.trim() || null, exercises: next.exercises, notes: next.notes },
      save,
    )
  }
  const setExercise = (i: number, item: RoutineExercise) =>
    change({ exercises: draft.exercises.map((e, j) => (j === i ? item : e)) })

  const rename = async () => {
    const next = name.trim()
    if (!next || next === routine.name) return setName(routine.name)
    try {
      await saver.flush()
      const saved = await api.updateRoutine(ws, routine.file, { name: next })
      await refresh()
      if (saved.file !== routine.file) onRenamed(saved.file)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this routine?',
      body: (
        <>
          <b>{routine.name}</b> and its page <span className="mono-s">{path}</span> are deleted. Workouts you logged
          with it stay in the log.
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    saver.cancel()
    try {
      await api.deleteRoutine(ws, routine.file)
      onClose()
      toast(`Deleted “${routine.name}”`, 'quiet')
      await refresh()
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  const start = async () => {
    await saver.flush()
    await starter.start(routine.file)
  }

  usePanelEscape(adding ? () => setAdding(false) : onClose)

  return (
    <aside className="panel card-panel" aria-label={`Routine: ${routine.name}`}>
      <div className="panel-h">
        <span className="mono muted trunc">Training / {adding ? 'Add exercise' : 'Routine'}</span>
        <span className="grow" />
        <SaveStatus state={saver.pending ? 'saving' : 'saved'} />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        {adding ? (
          <div className="col g12">
            <Button size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(false)}>
              [←] Back to {routine.name}
            </Button>
            <ExercisePicker
              ws={ws}
              onPick={(ex) => {
                change({ exercises: [...draft.exercises, routineExerciseOf(ex)] })
                setAdding(false)
              }}
            />
          </div>
        ) : (
          <div className="doc card-doc in-panel col g16">
            <TitleInput
              className="doc-title"
              value={name}
              aria-label="Routine name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void rename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
            <div className="kv" style={{ gridTemplateColumns: '84px minmax(0, 1fr)', gap: '8px 12px' }}>
              <span className="k">days</span>
              <div className="row g4 wrap" role="group" aria-label="Days">
                {TRAINING_DAYS.map((d) => (
                  <PillToggle
                    key={d}
                    pressed={draft.days.includes(d)}
                    onChange={() => change({ days: toggleDay(draft.days, d) })}
                  >
                    {d}
                  </PillToggle>
                ))}
              </div>
              <span className="k">folder</span>
              <TextInput
                compact
                value={draft.folder}
                placeholder="e.g. Push / Pull / Legs"
                aria-label="Folder"
                onChange={(e) => change({ folder: e.target.value })}
              />
            </div>

            <div className="col g12">
              <span className="flabel">Exercises</span>
              {draft.exercises.length === 0 && <span className="small muted">No exercises yet.</span>}
              {draft.exercises.map((e, i) => (
                <RoutineExerciseEditor
                  // oxlint-disable-next-line react/no-array-index-key -- the same exercise may appear twice; moving remounts on purpose
                  key={`${e.exercise}:${i}`}
                  item={e}
                  first={i === 0}
                  last={i === draft.exercises.length - 1}
                  units={units}
                  onChange={(item) => setExercise(i, item)}
                  onMove={(delta) => change({ exercises: moveItem(draft.exercises, i, i + delta) })}
                  onRemove={() => change({ exercises: draft.exercises.filter((_, j) => j !== i) })}
                />
              ))}
              <Button size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>
                <IconPlus size={12} /> Add exercise
              </Button>
            </div>

            <div className="col g6">
              <span className="flabel">Notes</span>
              <TextArea
                autoGrow={240}
                rows={3}
                value={draft.notes}
                placeholder="Cues, warm-up, anything to remember"
                aria-label="Notes"
                onChange={(e) => change({ notes: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
      <div className="row between panel-f">
        <Link to={fileUrl(ws, path)} className="link muted row g6 trunc">
          <IconFile size={13} />
          {path}
        </Link>
        <div className="row g8">
          <Button size="sm" onClick={() => void remove()}>
            Delete
          </Button>
          <Button size="sm" variant="primary" busy={starter.busy} onClick={() => void start()}>
            Start
          </Button>
        </div>
      </div>
    </aside>
  )
}
