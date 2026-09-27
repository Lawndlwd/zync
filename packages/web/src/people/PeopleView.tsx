import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useConfirm, useToast } from '../components/Dialog'
import { Field } from '../components/Field'
import { SwatchRow } from '../components/SwatchRow'
import { TextInput } from '../components/TextInput'
import { SWATCHES } from '../helpers/color'
import { errorMessage } from '../helpers/format'
import { usePeople } from '../hooks/usePeople'
import { PersonPanel } from '../memory/PersonPanel'
import { PersonRow } from './PersonRow'

export function PeopleView() {
  const { ws = '' } = useParams()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const people = usePeople()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])
  const [err, setErr] = useState('')
  const [params, setParams] = useSearchParams()
  const open = people.find((p) => p.id === params.get('person'))
  const setOpen = (id: string | null) =>
    setParams((p) => {
      if (id) p.set('person', id)
      else p.delete('person')
      return p
    })

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
    } catch (caught) {
      const msg = errorMessage(caught)
      setErr(msg)
      toast(msg, 'bad')
      return false
    } finally {
      await qc.invalidateQueries({ queryKey: ['people'] })
    }
  }

  return (
    <div className={`board-view${open ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g24" style={{ maxWidth: 920 }}>
          <div className="col g16">
            <span className="mono muted">All workspaces / people</span>
            <h1 className="display">People</h1>
            <p className="lede">
              Shared across <b>every workspace</b>. Anyone here can be assigned a card; <b>@ai</b> runs its cards on
              schedule. Open someone's <b>notes</b> to tell the AI who they are — it reads them in every chat.
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
                  active={open?.id === p.id}
                  onNotes={() => setOpen(p.id)}
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
      </div>
      {open && <PersonPanel key={open.id} ws={ws} person={open} people={people} onClose={() => setOpen(null)} />}
    </div>
  )
}
