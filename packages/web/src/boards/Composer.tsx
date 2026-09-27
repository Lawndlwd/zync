import { useState } from 'react'

import { Button } from '../components/Button'
import { DatePicker } from '../components/DatePicker'
import { IconButton } from '../components/IconButton'
import { TextArea } from '../components/TextArea'
import { IconCross, IconExpand } from '../icons'
import type { QuickCard } from '../types/boards'

/** Inline quick-add: Enter adds and stays open for the next; "More fields" opens the full card panel. */
export function Composer({
  onAdd,
  onMore,
  onClose,
}: {
  onAdd: (card: QuickCard) => Promise<unknown>
  onMore: (card: QuickCard) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const card = (): QuickCard => ({ title: title.trim(), ...(due ? { due } : {}) })
  // The full panel takes over the draft, so the inline one goes away.
  const more = () => {
    onMore(card())
    onClose()
  }
  const add = async () => {
    const next = card()
    if (!next.title || busy) return
    setBusy(true)
    await onAdd(next)
    setBusy(false)
    setTitle('')
    setDue(undefined)
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
            more()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            void add()
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        onBlur={(e) => {
          if (!title.trim() && !due && !e.currentTarget.parentElement?.contains(e.relatedTarget)) onClose()
        }}
      />
      <DatePicker
        compact
        optionalTime
        noPast
        placeholder="Due date"
        ariaLabel="Due"
        value={due}
        onChange={(v) => setDue(v ?? undefined)}
      />
      <div className="row between">
        <Button variant="primary" size="sm" busy={busy} disabled={!title.trim()} onClick={() => void add()}>
          Add
        </Button>
        <span className="row g4">
          <IconButton small label="More fields: assignee, labels, AI task… (⇧↵)" onClick={more}>
            <IconExpand size={12} sw={1.6} />
          </IconButton>
          <IconButton small label="Cancel (Esc)" onClick={onClose}>
            <IconCross size={12} sw={1.6} />
          </IconButton>
        </span>
      </div>
    </div>
  )
}
