import { useState } from 'react'

import { TextButton } from '../components/TextButton'
import { TextInput } from '../components/TextInput'
import { PROVIDER_NAMES } from '../helpers/connections'
import { ago } from '../helpers/dates'
import type { Connection } from '../types/connections'

export function ConnectionRow({
  connection: c,
  onRename,
  onReconnect,
  onRemove,
}: {
  connection: Connection
  onRename: (label: string) => void
  /** Only where signing in again is one click (Google). */
  onReconnect?: (() => void) | undefined
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="lr wrap">
      <span className="chip-provider mono-s">{PROVIDER_NAMES[c.provider]}</span>
      {editing ? (
        <TextInput
          compact
          autoFocus
          className="grow"
          aria-label="Name"
          defaultValue={c.label}
          maxLength={40}
          onBlur={(e) => {
            setEditing(false)
            if (e.target.value.trim() !== c.label) onRename(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className="grow col" style={{ minWidth: 0 }}>
          <span className="trunc">{c.label}</span>
          {c.label !== c.account && <span className="mono-s muted trunc">{c.account}</span>}
          {c.error && <span className="small danger-t">{c.error}</span>}
        </span>
      )}
      <span className="mono-s muted">added {ago(new Date(c.createdAt))}</span>
      {!editing && <TextButton onClick={() => setEditing(true)}>[Rename]</TextButton>}
      {onReconnect && c.error && <TextButton onClick={onReconnect}>[Reconnect]</TextButton>}
      <TextButton className="danger-t" onClick={onRemove}>
        [Remove]
      </TextButton>
    </div>
  )
}
