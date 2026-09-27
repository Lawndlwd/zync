import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api'
import { wsUrl } from '../helpers/urls'
import type { Person } from '../types/people'
import { PersonAvatar } from './PersonAvatar'
import { Select } from './Select'

const NONE = '__none'

/** Assignee picker: find-or-add, as in the handoff's people menu. `null` = unassigned. */
export function PersonSelect({
  value,
  people,
  onChange,
  compact,
  ariaLabel = 'Assignee',
}: {
  value: string | undefined
  people: Person[]
  onChange: (id: string | null) => void
  compact?: boolean
  ariaLabel?: string
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { ws = '' } = useParams()
  const options = [
    {
      value: NONE,
      text: 'unassigned',
      label: 'Unassigned',
      icon: <span className="av" style={{ border: '1px dashed var(--line)' }} />,
    },
    ...people.map((p) => ({
      value: p.id,
      text: `${p.name} ${p.id}`,
      label: p.name,
      icon: <PersonAvatar id={p.id} people={people} />,
      hint: `@${p.id}`,
    })),
  ]
  return (
    <Select
      value={value ?? NONE}
      options={options}
      compact={compact}
      searchable
      ariaLabel={ariaLabel}
      onChange={(v) => onChange(v === NONE ? null : v)}
      trigger={
        value ? (
          <span className="row g8 trunc">
            <PersonAvatar id={value} people={people} />
            {people.find((p) => p.id === value)?.name ?? value}
            <span className="mono-s muted">@{value}</span>
          </span>
        ) : (
          <span className="muted">Unassigned</span>
        )
      }
      footer={(close, q) => (
        <button
          type="button"
          className="mi mono"
          style={{ fontSize: 12 }}
          onClick={async () => {
            const name = q.trim()
            close()
            if (!name) {
              void navigate(wsUrl(ws, 'people'))
              return
            }
            const p = await api.createPerson(name)
            await qc.invalidateQueries({ queryKey: ['people'] })
            onChange(p.id)
          }}
        >
          [+] {q.trim() ? `Add “${q.trim()}”` : 'New person'}
        </button>
      )}
    />
  )
}
