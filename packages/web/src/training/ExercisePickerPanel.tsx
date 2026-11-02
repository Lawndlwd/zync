import { IconButton } from '../components/IconButton'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconCross } from '../icons'
import type { Exercise } from '../types/training'
import { ExercisePicker } from './ExercisePicker'

/** "Add exercise" beside a live workout. */
export function ExercisePickerPanel({
  ws,
  onPick,
  onClose,
}: {
  ws: string
  onPick: (ex: Exercise) => void
  onClose: () => void
}) {
  usePanelEscape(onClose)
  return (
    <aside className="panel card-panel" aria-label="Add exercise">
      <div className="panel-h">
        <span className="mono muted trunc">Training / Add exercise</span>
        <span className="grow" />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        <ExercisePicker ws={ws} onPick={onPick} />
      </div>
    </aside>
  )
}
