import { useState } from 'react'

import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { TextArea } from '../components/TextArea'
import { TextButton } from '../components/TextButton'
import { IconCross } from '../icons'

/** Inline quick-add: Enter adds and stays open for the next; "More fields" opens the full card panel. */
export function Composer({
  onAdd,
  onMore,
  onClose,
}: {
  onAdd: (title: string) => Promise<unknown>
  onMore: (title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async () => {
    const t = title.trim()
    if (!t || busy) return
    setBusy(true)
    await onAdd(t)
    setBusy(false)
    setTitle('')
  }
  return (
    <div className="kcard composer">
      <TextArea
        autoFocus
        autoGrow={140}
        rows={2}
        className="composer-in"
        placeholder="Card title…"
        aria-label="New card title"
        value={title}
        onChange={(e) => setTitle(e.target.value.replaceAll('\n', ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            onMore(title.trim())
          } else if (e.key === 'Enter') {
            e.preventDefault()
            void add()
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        onBlur={(e) => {
          if (!title.trim() && !e.currentTarget.parentElement?.contains(e.relatedTarget)) onClose()
        }}
      />
      <div className="row between">
        <span className="row g10">
          <Button variant="primary" size="sm" busy={busy} disabled={!title.trim()} onClick={() => void add()}>
            Add
          </Button>
          <TextButton onClick={() => onMore(title.trim())} title="Assignee, due date, labels, AI task… (⇧↵)">
            [⤢] More fields
          </TextButton>
        </span>
        <IconButton small label="Cancel (Esc)" onClick={onClose}>
          <IconCross size={12} sw={1.6} />
        </IconButton>
      </div>
    </div>
  )
}
