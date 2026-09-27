import { useState } from 'react'

import { Button } from '../components/Button'
import { PersonAvatar } from '../components/PersonAvatar'
import { SwatchPicker } from '../components/SwatchPicker'
import { TextInput } from '../components/TextInput'
import { plural } from '../helpers/format'
import type { Person } from '../types/people'

export function PersonRow({
  person: p,
  people,
  cards,
  active,
  onNotes,
  onRename,
  onColor,
  onDelete,
}: {
  person: Person
  people: Person[]
  cards: number
  active: boolean
  onNotes: () => void
  onRename: (name: string) => void
  onColor: (c: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const commit = (v: string) => {
    setEditing(false)
    if (v.trim() && v.trim() !== p.name) onRename(v.trim())
  }
  const sub = p.id === 'ai' ? '@ai · runs scheduled cards' : `@${p.id}${cards ? ` · ${plural(cards, 'card')}` : ''}`
  return (
    <div className="lr" style={{ padding: '14px 0' }}>
      <PersonAvatar id={p.id} people={people} size="xl" />
      <span className="col grow">
        {editing ? (
          <TextInput
            compact
            autoFocus
            defaultValue={p.name}
            aria-label={`Rename ${p.name}`}
            style={{ maxWidth: 280 }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(e.currentTarget.value)
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <button type="button" className="name-btn" onClick={() => setEditing(true)} title="Rename">
            {p.name}
          </button>
        )}
        <span className="mono-s muted">{sub}</span>
      </span>
      {p.builtin && <span className="label alt">Built-in</span>}
      <Button size="sm" variant={active ? 'primary' : undefined} onClick={onNotes}>
        Notes
      </Button>
      {p.id === 'ai' ? (
        <span className="sw" style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-soft)' }} />
      ) : (
        <SwatchPicker value={p.color} onChange={onColor} />
      )}
      {p.builtin ? (
        <span style={{ width: 92 }} />
      ) : (
        <Button variant="danger" size="sm" style={{ width: 92 }} onClick={onDelete}>
          Delete
        </Button>
      )}
    </div>
  )
}
