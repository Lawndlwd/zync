import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { api, type Person } from './api'
import { usePeople } from './boards/shared'
import { Button } from './components/Button'
import { SWATCHES, SwatchPicker, SwatchRow } from './components/Controls'
import { useConfirm, useToast } from './components/Dialog'
import { Field, TextInput } from './components/Field'
import { Card, PersonAvatar } from './ui'

export function PeopleView() {
  const { ws = '' } = useParams()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const people = usePeople()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])
  const [err, setErr] = useState('')

  // Card counts per person in this workspace.
  const boards = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) }).data ?? []
  const boardQs = useQueries({
    queries: boards.map((b) => ({ queryKey: ['board', ws, b.path], queryFn: () => api.board(ws, b.path) })),
  })
  const counts = new Map<string, number>()
  for (const q of boardQs)
    for (const c of q.data?.cards ?? []) if (c.assignee) counts.set(c.assignee, (counts.get(c.assignee) ?? 0) + 1)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr('')
      await fn()
      return true
    } catch (e) {
      setErr((e as Error).message)
      toast((e as Error).message, 'bad')
      return false
    } finally {
      await qc.invalidateQueries({ queryKey: ['people'] })
    }
  }

  return (
    <div className="page col g24" style={{ maxWidth: 920 }}>
      <div className="col g16">
        <span className="mono muted">All workspaces / people</span>
        <h1 className="display">People</h1>
        <p className="lede">
          Shared across <b>every workspace</b>. Anyone here can be assigned a card; <b>@ai</b> runs its cards on
          schedule.
        </p>
      </div>

      <form
        className="card plain"
        style={{ gap: 12 }}
        aria-label="Add person"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          if (await run(() => api.createPerson(name.trim(), color))) {
            toast(`Added ${name.trim()}`)
            setName('')
          }
        }}
      >
        <div className="card-h" style={{ marginBottom: 0 }}>
          <span className="t">[+] Add person</span>
        </div>
        <div className="row g12 wrap" style={{ alignItems: 'flex-end' }}>
          <Field label="Name" className="grow" style={{ minWidth: 200 }}>
            <TextInput
              placeholder="e.g. Sofia"
              value={name}
              invalid={!!err}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="field">
            <span className="flabel">Color</span>
            <div className="row" style={{ height: 40 }}>
              <SwatchRow value={color} onChange={setColor} />
            </div>
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={!name.trim()}>
            Add
          </Button>
        </div>
        {err && <span className="help err">{err}</span>}
      </form>

      <Card title={`${people.length} people`} meta="Name | handle | color">
        <div className="col">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              people={people}
              cards={counts.get(p.id) ?? 0}
              onRename={(n) => run(() => api.updatePerson(p.id, { name: n }))}
              onColor={(c) => run(() => api.updatePerson(p.id, { color: c }))}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Delete ${p.name}?`,
                  body: 'Their cards become unassigned; the card files stay where they are.',
                  confirmLabel: 'Delete',
                  destructive: true,
                })
                if (ok) void run(() => api.deletePerson(p.id))
              }}
            />
          ))}
        </div>
      </Card>
      <p className="small muted" style={{ margin: 0 }}>
        Deleting someone unassigns their cards; the card files stay where they are. Click a name to rename.
      </p>
    </div>
  )
}

function PersonRow({
  person: p,
  people,
  cards,
  onRename,
  onColor,
  onDelete,
}: {
  person: Person
  people: Person[]
  cards: number
  onRename: (name: string) => void
  onColor: (c: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const commit = (v: string) => {
    setEditing(false)
    if (v.trim() && v.trim() !== p.name) onRename(v.trim())
  }
  const sub =
    p.id === 'ai' ? '@ai · runs scheduled cards' : `@${p.id}${cards ? ` · ${cards} card${cards === 1 ? '' : 's'}` : ''}`
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
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
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
