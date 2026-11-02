import { useState } from 'react'

import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { TextInput } from '../components/TextInput'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useExercises } from '../hooks/useExercises'
import { IconSearch } from '../icons'
import type { Exercise } from '../types/training'
import { ExerciseLine } from './ExerciseLine'

const PAGE = 20

/** Search the library and pick an exercise (for a routine or a live workout). */
export function ExercisePicker({ ws, onPick }: { ws: string; onPick: (ex: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const query = { q: useDebouncedValue(q.trim(), 250), muscle, equipment: '', offset: 0 }
  const page = useExercises(ws, query, limit)
  const items = page.data?.items ?? []

  return (
    <div className="col g12">
      <div className="row g8">
        <TextInput
          compact
          autoFocus
          className="grow"
          icon={<IconSearch size={13} />}
          value={q}
          placeholder="Search exercises"
          aria-label="Search exercises"
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(PAGE)
          }}
        />
        <Select
          compact
          ariaLabel="Muscle group"
          value={muscle}
          options={[
            { value: '', label: 'All muscles' },
            ...(page.data?.muscles ?? []).map((m) => ({ value: m, label: m })),
          ]}
          onChange={(m) => {
            setMuscle(m)
            setLimit(PAGE)
          }}
        />
      </div>
      {page.error && <span className="help err">{page.error.message}</span>}
      <div className="col" role="listbox" aria-label="Exercises">
        {items.map((ex) => (
          <Button key={ex.id} role="option" aria-selected={false} className="tr-pick" onClick={() => onPick(ex)}>
            <ExerciseLine exercise={ex} />
          </Button>
        ))}
        {page.data && items.length === 0 && <span className="small muted">No exercise matches.</span>}
      </div>
      {page.data && page.data.total > items.length && (
        <Button size="sm" busy={page.isFetching} onClick={() => setLimit((l) => l + PAGE)}>
          Show more ({page.data.total - items.length} left)
        </Button>
      )}
    </div>
  )
}
