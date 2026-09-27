import { useState } from 'react'
import { isMap, isScalar, parseDocument } from 'yaml'

import { TextButton } from '../components/TextButton'
import { TextInput } from '../components/TextInput'
import { IconChevDown, IconChevRight } from '../icons'
import type { Person } from '../types/people'
import { LIST_KEYS } from './helpers'
import { PropertyRow } from './PropertyRow'
import { PropertyValue } from './PropertyValue'

// Frontmatter as a property sheet: each YAML key gets the control that fits its value
// (dates → calendar, lists → chips, booleans → switch, card status/assignee → pickers).

export function Properties({
  source,
  onChange,
  people,
}: {
  source: string
  onChange: (yaml: string) => void
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
          {doc.errors[0]?.message.split('\n')[0]} — fix it in a text editor or ask the AI.
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
              <PropertyRow key={key} name={key}>
                <PropertyValue name={key} node={pair.value} people={people} onChange={(v) => set(key, v)} />
              </PropertyRow>
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
                onChange={(e) => setNewKey(e.target.value.replaceAll(/[^\w-]/g, ''))}
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
