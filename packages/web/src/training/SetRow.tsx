import { Checkbox } from '../components/Checkbox'
import { IconButton } from '../components/IconButton'
import { TextButton } from '../components/TextButton'
import { amountFrom, previousText, weightText, withAmount } from '../helpers/training'
import { IconCross } from '../icons'
import type { LoggedSet, PlannedSet, Units } from '../types/training'
import { AmountInput } from './AmountInput'

/** One set of a live workout: Set · Previous · kg · reps · ✓. */
export function SetRow({
  n,
  set,
  previous,
  units,
  canRemove,
  onChange,
  onDone,
  onRemove,
}: {
  n: number
  set: LoggedSet
  previous: PlannedSet | undefined
  units: Units
  canRemove: boolean
  onChange: (next: LoggedSet) => void
  onDone: (done: boolean) => void
  onRemove: () => void
}) {
  return (
    <tr className={set.done ? 'done' : undefined}>
      <td>
        <TextButton
          className={set.warmup ? 'tr-warm' : 'muted'}
          title={set.warmup ? 'Warm-up set (click: working set)' : 'Working set (click: warm-up)'}
          aria-label={`Set ${n}${set.warmup ? ', warm-up' : ''}: toggle warm-up`}
          onClick={() => onChange({ ...set, warmup: !set.warmup })}
        >
          {set.warmup ? 'W' : n}
        </TextButton>
      </td>
      <td className="mono-s muted">{previousText(previous, units)}</td>
      <td>
        <AmountInput
          value={weightText(set.kg, units)}
          placeholder={previous?.kg === undefined ? '—' : weightText(previous.kg, units)}
          label={`Set ${n} ${units}`}
          onCommit={(t) => onChange(withAmount(set, 'kg', amountFrom(t, 'kg', units)))}
        />
      </td>
      <td>
        <AmountInput
          value={set.reps === undefined ? '' : String(set.reps)}
          placeholder={previous?.reps === undefined ? '—' : String(previous.reps)}
          label={`Set ${n} reps`}
          onCommit={(t) => onChange(withAmount(set, 'reps', amountFrom(t, 'reps', units)))}
        />
      </td>
      <td>
        <Checkbox checked={set.done} label={`Set ${n} done`} onChange={onDone} />
      </td>
      <td>
        {canRemove && (
          <IconButton small label={`Remove set ${n}`} onClick={onRemove}>
            <IconCross size={10} sw={1.6} />
          </IconButton>
        )}
      </td>
    </tr>
  )
}
