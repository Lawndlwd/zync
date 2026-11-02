import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { TextInput } from '../components/TextInput'
import { completeSet, nextSet } from '../helpers/training'
import { IconChevDown, IconChevUp, IconCross } from '../icons'
import type { LoggedSet, PlannedSet, Units, WorkoutExercise } from '../types/training'
import { SetRow } from './SetRow'

/** One exercise of a live workout: its note and the set table. `onSetDone` starts the rest timer. */
export function WorkoutExerciseBlock({
  item,
  previous,
  units,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  onSetDone,
}: {
  item: WorkoutExercise
  previous: PlannedSet[] | undefined
  units: Units
  first: boolean
  last: boolean
  onChange: (next: WorkoutExercise) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onSetDone: () => void
}) {
  const setAt = (i: number, next: LoggedSet) =>
    onChange({ ...item, sets: item.sets.map((s, j) => (j === i ? next : s)) })
  const done = item.sets.filter((s) => s.done).length

  return (
    <section className="card tr-wx col g10" aria-label={item.name}>
      <div className="row g6">
        <span className="h3 grow trunc">{item.name}</span>
        <span className="mono-s muted">
          {done}/{item.sets.length}
        </span>
        <IconButton small label="Move up" disabled={first} onClick={() => onMove(-1)}>
          <IconChevUp size={13} />
        </IconButton>
        <IconButton small label="Move down" disabled={last} onClick={() => onMove(1)}>
          <IconChevDown size={13} />
        </IconButton>
        <IconButton small label={`Remove ${item.name}`} onClick={onRemove}>
          <IconCross size={12} sw={1.6} />
        </IconButton>
      </div>
      <TextInput
        compact
        value={item.note ?? ''}
        placeholder="Note (seat height, grip, how it felt…)"
        aria-label={`${item.name} note`}
        onChange={(e) => {
          const { note: _old, ...rest } = item
          onChange(e.target.value ? { ...rest, note: e.target.value } : rest)
        }}
      />
      <table className="tbl tr-sets">
        <thead>
          <tr>
            <th>Set</th>
            <th>Previous</th>
            <th>{units}</th>
            <th>Reps</th>
            <th aria-label="Done">✓</th>
            <th aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {item.sets.map((s, i) => (
            <SetRow
              // oxlint-disable-next-line react/no-array-index-key -- sets are positional: set 1, set 2…
              key={i}
              n={i + 1}
              set={s}
              previous={previous?.[i]}
              units={units}
              canRemove={item.sets.length > 1}
              onChange={(next) => setAt(i, next)}
              onDone={(isDone) => {
                setAt(i, isDone ? completeSet(s, previous?.[i]) : { ...s, done: false })
                if (isDone) onSetDone()
              }}
              onRemove={() => onChange({ ...item, sets: item.sets.filter((_, j) => j !== i) })}
            />
          ))}
        </tbody>
      </table>
      <Button
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange({ ...item, sets: [...item.sets, nextSet(item.sets)] })}
      >
        [+] Add set
      </Button>
    </section>
  )
}
