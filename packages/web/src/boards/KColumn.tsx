import { type DragEvent, useCallback, useRef, useState } from 'react'

import { IconButton } from '../components/IconButton'
import { Popover } from '../components/Popover'
import { TextInput } from '../components/TextInput'
import { IconPlus } from '../icons'
import type { Board, Column } from '../types/boards'
import { Composer } from './Composer'
import { DONE_PREVIEW } from './helpers'

export function KColumn({
  column,
  index,
  board,
  count,
  isDrop,
  collapse,
  total,
  onRename,
  onMove,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
  onQuickAdd,
  onMore,
  renderCards,
}: {
  column: Column
  index: number
  board: Board
  count: number
  isDrop: boolean
  collapse: boolean
  total: number
  onRename: (name: string) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: (e: DragEvent<HTMLElement>) => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onQuickAdd: (title: string) => Promise<unknown>
  onMore: (title: string) => void
  renderCards: (limit: number) => React.ReactNode
}) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [composing, setComposing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenu(false), [])
  const limit = collapse && !expanded ? DONE_PREVIEW : Number.POSITIVE_INFINITY

  const commitRename = (v: string) => {
    setRenaming(false)
    if (v.trim() && v.trim() !== column.name) onRename(v.trim())
  }

  return (
    <section
      className={`kcol${isDrop ? ' is-drop' : ''}`}
      aria-label={column.name}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="kcol-h">
        {renaming ? (
          <TextInput
            compact
            autoFocus
            defaultValue={column.name}
            aria-label="Column name"
            style={{ height: 28 }}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(e.currentTarget.value)
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <span className="n" onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
            <b>{count}</b>
            {column.name}
          </span>
        )}
        <IconButton ref={menuBtn} small label="Column options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="3.5" cy="8" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="12.5" cy="8" r="1.2" />
          </svg>
        </IconButton>
        <Popover anchor={menuBtn} open={menu} onClose={closeMenu} align="end" role="menu">
          {[
            { label: 'Rename', fn: () => setRenaming(true), disabled: false },
            { label: 'Add card', fn: () => setComposing(true), disabled: false },
            { label: 'Move left', fn: () => onMove(-1), disabled: index === 0 },
            { label: 'Move right', fn: () => onMove(1), disabled: index === board.columns.length - 1 },
          ].map(({ label, fn, disabled }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className="mi"
              disabled={disabled}
              onClick={() => {
                closeMenu()
                fn()
              }}
            >
              {label}
            </button>
          ))}
          <span className="sepline" />
          <button
            type="button"
            role="menuitem"
            className="mi danger-t"
            disabled={board.columns.length < 2}
            onClick={() => {
              closeMenu()
              onDelete()
            }}
          >
            Delete column
          </button>
        </Popover>
      </div>
      {renderCards(limit)}
      {collapse && (
        <button type="button" className="kadd" onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Show less' : `Show ${total - DONE_PREVIEW} more`}
        </button>
      )}
      {composing ? (
        <Composer onAdd={onQuickAdd} onMore={onMore} onClose={() => setComposing(false)} />
      ) : (
        <button type="button" className="kadd" data-tour="add-card" onClick={() => setComposing(true)}>
          <IconPlus size={12} sw={1.6} />
          Add card
        </button>
      )}
    </section>
  )
}
