import { useState } from 'react'

import { Button } from '../components/Button'
import { TextInput } from '../components/TextInput'

export function AddColumn({
  open,
  setOpen,
  onAdd,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState('')
  if (!open)
    return (
      <button type="button" className="kcol kcol-add" onClick={() => setOpen(true)}>
        <span className="mono">[+] Add column</span>
      </button>
    )
  const commit = () => {
    if (name.trim()) onAdd(name.trim())
    setName('')
    setOpen(false)
  }
  return (
    <div className="kcol" style={{ gap: 10 }}>
      <TextInput
        compact
        autoFocus
        placeholder="Column name"
        aria-label="New column name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <div className="row g8">
        <Button variant="primary" size="sm" disabled={!name.trim()} onClick={commit}>
          Add column
        </Button>
        <Button size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
