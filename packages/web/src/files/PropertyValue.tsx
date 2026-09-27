import { isMap, isScalar, isSeq } from 'yaml'

import { DatePicker } from '../components/DatePicker'
import { PersonSelect } from '../components/PersonSelect'
import { TagInput } from '../components/TagInput'
import { TextInput } from '../components/TextInput'
import { Toggle } from '../components/Toggle'
import type { Person } from '../types/people'
import { DATE, DATE_KEYS, LIST_KEYS, textOf } from './helpers'

export function PropertyValue({
  name,
  node,
  people,
  onChange,
}: {
  name: string
  node: unknown
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
        suggestions={name === 'people' ? people.map((p) => p.id) : undefined}
        onChange={onChange}
        addLabel={name === 'context' ? '+ file or folder' : '+ add'}
      />
    )
  }
  if (isMap(node))
    return (
      <span className="mono-s muted trunc" title={String(node)}>
        {node.items
          .map((p) => {
            const key = isScalar(p.key) ? textOf(p.key.value) : '…'
            const val = isScalar(p.value) ? textOf(p.value.value) : '…'
            return `${key}: ${val}`
          })
          .join(' · ')}
      </span>
    )
  const value = isScalar(node) ? node.value : node
  if (typeof value === 'boolean') return <Toggle label={name} checked={value} onChange={onChange} />
  const text = textOf(value)
  if (name === 'assignee') return <PersonSelect compact value={text || undefined} people={people} onChange={onChange} />
  if (DATE_KEYS.has(name) || DATE.test(text))
    return (
      <DatePicker
        compact
        ariaLabel={name}
        withTime={name === 'runAt' || name === 'run_at'}
        optionalTime
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
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
