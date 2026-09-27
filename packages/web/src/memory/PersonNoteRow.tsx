import { PersonAvatar } from '../components/PersonAvatar'
import { IconChevRight } from '../icons'
import type { Person } from '../types/people'

export function PersonNoteRow({
  person: p,
  people,
  notes,
  active,
  onOpen,
}: {
  person: Person
  people: Person[]
  notes?: string
  active: boolean
  onOpen: () => void
}) {
  const role = p.id === 'me' ? 'About you' : p.id === 'ai' ? 'How the AI should work' : `@${p.id}`
  const first = notes
    ?.split('\n')
    .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
    .find(Boolean)
  return (
    <button
      type="button"
      className={`lr row-link${active ? ' hl' : ''}`}
      onClick={onOpen}
      style={{ textAlign: 'left' }}
    >
      <PersonAvatar id={p.id} people={people} size="l" />
      <span className="col grow" style={{ minWidth: 0 }}>
        <span className="row g8">
          <b style={{ fontWeight: 500 }}>{p.name}</b>
          <span className="mono-s muted">{role}</span>
        </span>
        <span className={`small trunc${first ? '' : ' muted'}`}>{first ?? 'No notes yet — add some'}</span>
      </span>
      <IconChevRight />
    </button>
  )
}
