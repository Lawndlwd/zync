import { PersonAvatar } from '../components/PersonAvatar'
import type { Person } from '../types/people'

export function AssigneeFilter({
  who,
  ids,
  people,
  onChange,
}: {
  who: string
  ids: string[]
  people: Person[]
  onChange: (v: string) => void
}) {
  return (
    <div className="row g6" role="group" aria-label="Filter by assignee">
      <button type="button" className={`pill${who ? '' : ' on'}`} style={{ height: 30 }} onClick={() => onChange('')}>
        All
      </button>
      {ids.map((id) => {
        const name = people.find((p) => p.id === id)?.name ?? id
        return (
          <button
            key={id}
            type="button"
            className={`av-filter${who === id ? ' on' : ''}`}
            aria-pressed={who === id}
            aria-label={`Only @${id} (${name})`}
            title={`Only @${id}`}
            onClick={() => onChange(who === id ? '' : id)}
          >
            <PersonAvatar id={id} people={people} size="l" />
          </button>
        )
      })}
    </div>
  )
}
