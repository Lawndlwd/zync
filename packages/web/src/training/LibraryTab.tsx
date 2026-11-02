import { useState } from 'react'
import { Link } from 'react-router'

import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { Select } from '../components/Select'
import { TextInput } from '../components/TextInput'
import { trainingUrl } from '../helpers/urls'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useExercises } from '../hooks/useExercises'
import { IconSearch } from '../icons'
import { ExerciseLine } from './ExerciseLine'

const PAGE = 30

/** The exercise library: search, filter by muscle and equipment, page through, open one beside. */
export function LibraryTab({ ws, selected }: { ws: string; selected: string }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [offset, setOffset] = useState(0)
  const debounced = useDebouncedValue(q.trim(), 250)
  const page = useExercises(ws, { q: debounced, muscle, equipment, offset }, PAGE)
  const data = page.data
  const items = data?.items ?? []
  const base = trainingUrl(ws, 'library')

  return (
    <div className="col g16">
      <div className="row g8 wrap">
        <TextInput
          compact
          className="grow"
          style={{ minWidth: 220 }}
          icon={<IconSearch size={13} />}
          value={q}
          placeholder="Search 1,300+ exercises"
          aria-label="Search exercises"
          onChange={(e) => {
            setQ(e.target.value)
            setOffset(0)
          }}
        />
        <Select
          compact
          ariaLabel="Muscle group"
          value={muscle}
          options={[{ value: '', label: 'All muscles' }, ...(data?.muscles ?? []).map((m) => ({ value: m, label: m }))]}
          onChange={(m) => {
            setMuscle(m)
            setOffset(0)
          }}
        />
        <Select
          compact
          ariaLabel="Equipment"
          value={equipment}
          options={[
            { value: '', label: 'All equipment' },
            ...(data?.equipment ?? []).map((m) => ({ value: m, label: m })),
          ]}
          onChange={(m) => {
            setEquipment(m)
            setOffset(0)
          }}
        />
        <ButtonLink to={`${base}?new=exercise`}>[+] Custom exercise</ButtonLink>
      </div>

      {page.error && <p className="lede danger-t">{page.error.message}</p>}
      {page.isLoading && <div className="skel" style={{ height: 320 }} />}
      {data && (
        <>
          <span className="mono-s muted">
            {data.total === 0
              ? 'No exercise matches'
              : `${offset + 1}–${offset + items.length} of ${data.total.toLocaleString('en-US')}`}
            {page.isFetching && ' · loading…'}
          </span>
          <div className="col tr-library" role="list">
            {items.map((ex) => (
              <Link
                key={ex.id}
                role="listitem"
                to={`${base}?exercise=${encodeURIComponent(ex.id)}`}
                className={`lr row-link${ex.id === selected ? ' hl' : ''}`}
              >
                <ExerciseLine exercise={ex} />
              </Link>
            ))}
          </div>
          {data.total > PAGE && (
            <div className="row g8">
              <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                [←] Previous
              </Button>
              <Button size="sm" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
                Next [→]
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
