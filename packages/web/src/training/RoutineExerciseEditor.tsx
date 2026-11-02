import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { Select } from '../components/Select'
import { TextInput } from '../components/TextInput'
import { amountFrom, nextPlannedSet, REST_OPTIONS, restOptionLabel, weightText, withAmount } from '../helpers/training'
import { IconChevDown, IconChevUp, IconCross } from '../icons'
import type { PlannedSet, RoutineExercise, Units } from '../types/training'
import { AmountInput } from './AmountInput'

/** One exercise of a routine: its scheme, rest, and the planned sets (+/−). */
export function RoutineExerciseEditor({
  item,
  first,
  last,
  units,
  onChange,
  onMove,
  onRemove,
}: {
  item: RoutineExercise
  first: boolean
  last: boolean
  units: Units
  onChange: (next: RoutineExercise) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const setAt = (i: number, patch: PlannedSet) =>
    onChange({ ...item, sets: item.sets.map((s, j) => (j === i ? patch : s)) })
  const rest = item.rest ?? 90

  return (
    <section className="tr-rx col g10" aria-label={item.name}>
      <div className="row g6">
        <span className="grow trunc" style={{ fontWeight: 500 }}>
          {item.name}
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
      <div className="row g8">
        <TextInput
          compact
          className="grow"
          value={item.scheme}
          placeholder="3×8-12 · 90s"
          aria-label={`${item.name} scheme`}
          onChange={(e) => onChange({ ...item, scheme: e.target.value })}
        />
        <Select
          compact
          ariaLabel={`${item.name} rest`}
          value={String(rest)}
          options={[...new Set([...REST_OPTIONS, rest])]
            .toSorted((a, b) => a - b)
            .map((s) => ({ value: String(s), label: restOptionLabel(s) }))}
          onChange={(s) => onChange({ ...item, rest: Number(s) })}
        />
      </div>
      <table className="tbl tr-sets">
        <thead>
          <tr>
            <th>Set</th>
            <th>{units}</th>
            <th>Reps</th>
          </tr>
        </thead>
        <tbody>
          {item.sets.map((s, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- sets are positional: set 1, set 2…
            <tr key={i}>
              <td className="mono-s muted">{i + 1}</td>
              <td>
                <AmountInput
                  value={weightText(s.kg, units)}
                  placeholder="—"
                  label={`Set ${i + 1} ${units}`}
                  onCommit={(t) => setAt(i, withAmount(s, 'kg', amountFrom(t, 'kg', units)))}
                />
              </td>
              <td>
                <AmountInput
                  value={s.reps === undefined ? '' : String(s.reps)}
                  placeholder="—"
                  label={`Set ${i + 1} reps`}
                  onCommit={(t) => setAt(i, withAmount(s, 'reps', amountFrom(t, 'reps', units)))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row g8">
        <Button size="sm" onClick={() => onChange({ ...item, sets: [...item.sets, nextPlannedSet(item.sets)] })}>
          [+] Set
        </Button>
        <Button
          size="sm"
          disabled={item.sets.length <= 1}
          onClick={() => onChange({ ...item, sets: item.sets.slice(0, -1) })}
        >
          [−] Set
        </Button>
      </div>
    </section>
  )
}
