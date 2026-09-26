import { useState } from 'react'
import { isMap, isScalar, isSeq, parseDocument } from 'yaml'
import type { Board, Person } from '../api'
import { TextButton } from '../components/Button'
import { Toggle } from '../components/Controls'
import { DatePicker } from '../components/DatePicker'
import { TextInput } from '../components/Field'
import { PersonSelect } from '../components/PersonSelect'
import { Select } from '../components/Select'
import { TagInput } from '../components/TagInput'
import { IconChevDown, IconChevRight } from '../icons'

// Frontmatter as a property sheet: each YAML key gets the control that fits its value
// (dates → calendar, lists → chips, booleans → switch, card status/assignee → pickers).

const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/
const LIST_KEYS = new Set(['labels', 'context', 'tags'])
const DATE_KEYS = new Set(['due', 'runAt', 'run_at', 'date'])

export function Properties({
  source,
  onChange,
  board,
  people,
}: {
  source: string
  onChange: (yaml: string) => void
  /** Set when the file is a card on this board. */
  board?: Board
  people: Person[]
}) {
  const [doc] = useState(() => parseDocument(source))
  const [, bump] = useState(0)
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const root = doc.contents
  const items = isMap(root) ? root.items : []

  const set = (key: string, value: unknown) => {
    if (value === null || value === undefined || (Array.isArray(value) && !value.length && !LIST_KEYS.has(key)))
      doc.delete(key)
    else doc.set(key, value)
    bump((n) => n + 1)
    onChange(String(doc))
  }

  if (doc.errors.length)
    return (
      <section className="props" aria-label="Properties">
        <div className="props-h">
          <span className="mono danger-t">Properties · invalid YAML</span>
        </div>
        <p className="small muted" style={{ margin: 0, padding: '10px 14px' }}>
          {doc.errors[0].message.split('\n')[0]} — fix it in a text editor or ask the AI.
        </p>
      </section>
    )

  return (
    <section className="props" aria-label="Properties">
      <div className="props-h">
        <button type="button" className="mono row g8" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <IconChevDown /> : <IconChevRight />}
          Properties <span className="muted">· frontmatter · {items.length}</span>
        </button>
        <TextButton className="muted" onClick={() => setAdding(true)}>
          [+] Add property
        </TextButton>
      </div>
      {open && (
        <div className="kv props-grid">
          {items.map((pair) => {
            const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key)
            return (
              <Row key={key} name={key}>
                <Value name={key} node={pair.value} board={board} people={people} onChange={(v) => set(key, v)} />
              </Row>
            )
          })}
          {adding && (
            <>
              <TextInput
                compact
                mono
                autoFocus
                placeholder="key"
                aria-label="New property name"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.replace(/[^\w-]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKey) {
                    set(newKey, LIST_KEYS.has(newKey) ? [] : '')
                    setNewKey('')
                    setAdding(false)
                  }
                  if (e.key === 'Escape') setAdding(false)
                }}
                onBlur={() => {
                  if (newKey) set(newKey, LIST_KEYS.has(newKey) ? [] : '')
                  setNewKey('')
                  setAdding(false)
                }}
              />
              <span className="mono-s muted" style={{ alignSelf: 'center' }}>
                Enter to add
              </span>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <span className="k trunc" title={name}>
        {name}
      </span>
      <div className="props-v">{children}</div>
    </>
  )
}

function Value({
  name,
  node,
  board,
  people,
  onChange,
}: {
  name: string
  node: unknown
  board?: Board
  people: Person[]
  onChange: (v: unknown) => void
}) {
  if (isSeq(node) || LIST_KEYS.has(name)) {
    const values = isSeq(node) ? node.items.map((i) => String(isScalar(i) ? i.value : i)) : []
    return (
      <TagInput
        ariaLabel={name}
        variant={name === 'context' ? 'tag' : 'label'}
        values={values}
        onChange={onChange}
        addLabel={name === 'context' ? '+ file or folder' : '+ add'}
      />
    )
  }
  if (isMap(node))
    return (
      <span className="mono-s muted trunc" title={String(node)}>
        {node.items
          .map((p) => `${isScalar(p.key) ? p.key.value : p.key}: ${isScalar(p.value) ? p.value.value : '…'}`)
          .join(' · ')}
      </span>
    )
  const value = isScalar(node) ? node.value : node
  if (typeof value === 'boolean') return <Toggle label={name} checked={value} onChange={onChange} />
  const text = value === null || value === undefined ? '' : String(value)
  if (board && name === 'status')
    return (
      <Select
        compact
        ariaLabel="status"
        value={text || board.columns[0].id}
        options={board.columns.map((c) => ({ value: c.id, label: c.name, text: c.name }))}
        onChange={onChange}
      />
    )
  if (name === 'assignee') return <PersonSelect compact value={text || undefined} people={people} onChange={onChange} />
  if (DATE_KEYS.has(name) || DATE.test(text))
    return (
      <DatePicker
        compact
        ariaLabel={name}
        withTime={text.includes('T') || name === 'runAt' || name === 'run_at'}
        value={text || undefined}
        onChange={onChange}
      />
    )
  return (
    <TextInput
      compact
      mono={typeof value === 'number'}
      key={text}
      defaultValue={text}
      aria-label={name}
      onBlur={(e) => {
        const v = e.target.value
        if (v === text) return
        onChange(typeof value === 'number' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
