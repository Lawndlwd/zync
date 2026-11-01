import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { TagInput } from '../components/TagInput'
import { TextArea } from '../components/TextArea'
import { TextInput } from '../components/TextInput'
import { TitleInput } from '../components/TitleInput'
import { errorMessage } from '../helpers/format'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconCross } from '../icons'

type Draft = {
  name: string
  muscleGroup: string
  equipment: string
  target: string
  secondary: string[]
  steps: string
}

/** A custom exercise, written by hand: saved as Training/Exercises/<name>.md on "Create". */
export function CustomExerciseDraft({
  ws,
  onCreated,
  onClose,
}: {
  ws: string
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [d, setD] = useState<Draft>({
    name: '',
    muscleGroup: '',
    equipment: 'Body Weight',
    target: '',
    secondary: [],
    steps: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))

  const create = async () => {
    if (busy) return
    if (!d.name.trim() || !d.muscleGroup.trim() || !d.equipment.trim())
      return setError('Give it a name, a muscle group and the equipment it needs.')
    const steps = d.steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    setBusy(true)
    try {
      const made = await api.createExercise(ws, {
        name: d.name.trim(),
        muscleGroup: d.muscleGroup.trim(),
        equipment: d.equipment.trim(),
        ...(d.target.trim() ? { target: d.target.trim() } : {}),
        ...(d.secondary.length ? { secondary: d.secondary } : {}),
        ...(steps.length ? { instructions: steps } : {}),
      })
      await qc.invalidateQueries({ queryKey: ['training', ws, 'exercises'] })
      onCreated(made.id)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  usePanelEscape(onClose, { onSubmit: () => void create() })

  return (
    <aside className="panel card-panel" aria-label="New exercise">
      <div className="panel-h">
        <span className="mono muted trunc">Training / New exercise</span>
        <span className="grow" />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        <div className="doc card-doc in-panel col g16">
          <TitleInput
            autoFocus
            className="doc-title"
            value={d.name}
            placeholder="Exercise name"
            aria-label="Exercise name"
            onChange={(e) => set({ name: e.target.value })}
          />
          <div className="kv" style={{ gridTemplateColumns: '84px minmax(0, 1fr)', gap: '8px 12px' }}>
            <span className="k">muscle</span>
            <TextInput
              compact
              value={d.muscleGroup}
              placeholder="Chest"
              aria-label="Muscle group"
              onChange={(e) => set({ muscleGroup: e.target.value })}
            />
            <span className="k">equipment</span>
            <TextInput
              compact
              value={d.equipment}
              placeholder="Dumbbell"
              aria-label="Equipment"
              onChange={(e) => set({ equipment: e.target.value })}
            />
            <span className="k">target</span>
            <TextInput
              compact
              value={d.target}
              placeholder="pectorals"
              aria-label="Target muscle"
              onChange={(e) => set({ target: e.target.value })}
            />
            <span className="k" style={{ alignSelf: 'start', paddingTop: 4 }}>
              also
            </span>
            <TagInput
              ariaLabel="Secondary muscles"
              variant="tag"
              addLabel="+ muscle"
              placeholder="triceps"
              values={d.secondary}
              onChange={(secondary) => set({ secondary })}
            />
          </div>
          <div className="col g6">
            <span className="flabel">Steps · one per line</span>
            <TextArea
              autoGrow={320}
              rows={5}
              value={d.steps}
              placeholder={'Lie on the bench, feet flat.\nLower the bar to mid-chest.\nPress up.'}
              aria-label="Steps"
              onChange={(e) => set({ steps: e.target.value })}
            />
          </div>
          {error && <span className="help err">{error}</span>}
        </div>
      </div>
      <div className="row between panel-f">
        <span className="mono-s muted">
          <span className="kbd">⌘↵</span> create · <span className="kbd">Esc</span> cancel
        </span>
        <Button variant="primary" size="sm" busy={busy} onClick={() => void create()}>
          Create exercise
        </Button>
      </div>
    </aside>
  )
}
