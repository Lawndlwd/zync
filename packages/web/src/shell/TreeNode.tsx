import type { ReactNode } from 'react'
import { useState } from 'react'

import { dirname } from '../helpers/paths'
import { IconBoard, IconChevDown, IconChevRight, IconFile, IconFolder, IconSpin } from '../icons'
import type { TreeEntry } from '../types/files'
import type { TreeCtx, TreeDropZone } from '../types/shell'
import { depthProps, draggedPaths } from './helpers'
import { TreeNameInput } from './TreeNameInput'

export function TreeNode({
  entry,
  depth,
  ctx,
  siblings,
  children,
}: {
  entry: TreeEntry
  depth: number
  ctx: TreeCtx
  siblings: TreeEntry[]
  /** An open folder's contents (TreeDir renders them, so the two files don't import each other). */
  children: (path: string, depth: number) => ReactNode
}) {
  const isDir = entry.type === 'dir'
  const isBoard = isDir && ctx.boards.has(entry.path)
  const within = (p: string) => p === entry.path || p.startsWith(`${entry.path}/`)
  const creatingInside = !!ctx.creating && within(ctx.creating.dir)
  const [open, setOpen] = useState(
    () => within(ctx.current) || within(ctx.currentBoard) || within(ctx.currentDir) || creatingInside,
  )
  // Starting a new page or folder inside opens the folder.
  const [wasCreatingInside, setWasCreatingInside] = useState(creatingInside)
  if (wasCreatingInside !== creatingInside) {
    setWasCreatingInside(creatingInside)
    if (creatingInside) setOpen(true)
  }
  const [over, setOver] = useState<TreeDropZone | null>(null)
  const isSelected = ctx.selected.has(entry.path)

  if (ctx.renaming === entry.path) return <TreeNameInput depth={depth} ctx={ctx} entry={entry} />

  const { cls, style } = depthProps(depth)
  const active = isBoard
    ? ctx.currentBoard === entry.path
    : isDir
      ? ctx.currentDir === entry.path
      : ctx.current === entry.path
  const ai = ctx.cardAi.get(entry.path)
  const meta = isBoard ? (
    <span className="meta">{ctx.cardCount.get(entry.path) ?? ''}</span>
  ) : ai === 'running' ? (
    <span className="meta">
      <IconSpin size={10} sw={2.2} />
    </span>
  ) : ai === 'done' ? (
    <span className="meta">AI</span>
  ) : over === 'into' ? (
    <span className="meta">drop to move</span>
  ) : null

  const onActivate = (beside = false) => {
    if (isDir) {
      ctx.selectDir(entry.path)
      if (!beside) setOpen(true)
      ctx.open(entry, beside)
    } else {
      ctx.selectDir(dirname(entry.path))
      ctx.open(entry, beside)
    }
  }

  return (
    <>
      <div
        className={`ti${cls}${active ? ' on' : ''}${isSelected ? ' sel' : ''}${over === 'into' ? ' drop' : over ? ` drop-${over}` : ''}`}
        data-path={entry.path}
        style={style}
        role="treeitem"
        tabIndex={0}
        aria-selected={ctx.selected.size ? isSelected : active}
        aria-expanded={isDir ? open : undefined}
        aria-current={active ? 'page' : undefined}
        title={entry.path}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.setData('text/zync-path', entry.path)
          if (isSelected && ctx.selected.size > 1)
            e.dataTransfer.setData('text/zync-paths', JSON.stringify([...ctx.selected]))
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('text/zync-path') || isSelected) return
          e.preventDefault()
          e.stopPropagation()
          // Top or bottom edge: place before / after. Middle of a folder: move into it.
          const r = e.currentTarget.getBoundingClientRect()
          const y = (e.clientY - r.top) / r.height
          setOver(isDir ? (y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'into') : y < 0.5 ? 'before' : 'after')
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          const zone = over
          setOver(null)
          const froms = draggedPaths(e.dataTransfer).filter((f) => f !== entry.path)
          if (!froms.length || !zone) return
          e.preventDefault()
          e.stopPropagation()
          if (zone === 'into') ctx.moveInto(froms, entry.path)
          else ctx.place(froms, entry, zone, siblings)
        }}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) return ctx.select(entry.path, 'toggle')
          if (e.shiftKey) return ctx.select(entry.path, 'range')
          ctx.clearSelection()
          onActivate(e.altKey)
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          const items = [
            ...(e.currentTarget.closest('[role="tree"]')?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []),
          ]
          const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
          if (step) {
            e.preventDefault()
            const next = items[items.indexOf(e.currentTarget) + step]
            next?.focus()
            if (next?.dataset.path && e.shiftKey) {
              if (!ctx.selected.size) ctx.select(entry.path, 'only')
              ctx.select(next.dataset.path, 'range')
            }
            return
          }
          if (e.key === ' ') {
            e.preventDefault()
            ctx.select(entry.path, 'toggle')
          }
          if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            const paths = items.map((el) => el.dataset.path).filter((p): p is string => !!p)
            const [first] = paths
            const last = paths.at(-1)
            if (first && last) {
              ctx.select(first, 'only')
              ctx.select(last, 'range')
            }
          }
          if (e.key === 'Escape' && ctx.selected.size) {
            e.preventDefault()
            ctx.clearSelection()
          }
          if (e.key === 'Enter') onActivate(e.altKey)
          if (e.key === 'F2') ctx.startRename(entry)
          if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
            if (isSelected && ctx.selected.size > 1) ctx.removeMany([...ctx.selected])
            else ctx.remove(entry)
          }
          if (isDir && e.key === 'ArrowRight') setOpen(true)
          if (isDir && e.key === 'ArrowLeft') setOpen(false)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          ctx.menu(entry, e.clientX, e.clientY)
        }}
      >
        {isDir ? (
          <span
            className="ch row"
            onClick={(e) => {
              // The chevron only folds; the label opens boards.
              e.stopPropagation()
              setOpen((o) => !o)
              ctx.selectDir(entry.path)
            }}
          >
            {open ? <IconChevDown className="ch" /> : <IconChevRight className="ch" />}
          </span>
        ) : depth === 0 ? (
          <span className="ch" />
        ) : null}
        {isBoard ? (
          <IconBoard size={15} sw={1.3} />
        ) : isDir ? (
          <IconFolder />
        ) : depth === 0 ? (
          <IconFile size={15} sw={1.3} />
        ) : null}
        <span className="ti-name">{entry.name}</span>
        {meta}
      </div>
      {isDir && open && children(entry.path, depth + 1)}
    </>
  )
}
