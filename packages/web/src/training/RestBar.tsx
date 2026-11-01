import { Button } from '../components/Button'
import { clockLabel } from '../helpers/training'

/** The running rest timer: time left, a bar that empties, +15 s and skip. */
export function RestBar({
  left,
  total,
  onAdd,
  onSkip,
}: {
  left: number
  total: number
  onAdd: () => void
  onSkip: () => void
}) {
  return (
    <div className="tr-rest row g12" role="timer" aria-live="off" aria-label="Rest">
      <span className="mono">Rest</span>
      <span className="num-m" style={{ fontSize: 28 }}>
        {clockLabel(left)}
      </span>
      <span className="tr-rest-track grow" aria-hidden="true">
        <span style={{ width: `${total > 0 ? (left / total) * 100 : 0}%` }} />
      </span>
      <Button size="sm" onClick={onAdd}>
        +15 s
      </Button>
      <Button size="sm" onClick={onSkip}>
        Skip
      </Button>
    </div>
  )
}
