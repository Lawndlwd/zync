import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { api, basename, dirname, joinPath, type TreeEntry } from '../api'
import { boardUrl } from '../boards/shared'
import { useConfirm } from '../components/Dialog'
import { Popover } from '../components/Popover'
import { folderUrl } from '../files/FolderView'
import { IconBoard, IconChevDown, IconChevRight, IconChevUp, IconFile, IconFolder, IconSpin } from '../icons'
import { useDismiss } from '../ui'
import type { WorkspaceData } from '../workspaceData'
import { type Creating, fileUrl, useShell, useShowHidden, wsUrl } from './context'

// The workspace folder tree in the sidebar. Same folders everywhere: board folders open the board,
// files open the editor. Right-click (or F2 / Delete on a focused row) to rename, delete, create.

interface Ctx {
  ws: string
  current: string
  currentBoard: string
  currentDir: string
  boards: Set<string>
  cardCount: Map<string, number>
  cardAi: Map<string, 'running' | 'done' | undefined>
  creating: Creating | null
  renaming: string | null
  /** Open the entry; `beside` puts it in a split pane next to the current view. */
  open: (e: TreeEntry, beside?: boolean) => void
  selectDir: (dir: string) => void
  menu: (e: TreeEntry, x: number, y: number) => void
  create: (name: string) => void
  cancelCreate: () => void
  rename: (e: TreeEntry, name: string) => void
  cancelRename: () => void
  startRename: (e: TreeEntry) => void
  remove: (e: TreeEntry) => void
  moveInto: (froms: string[], dir: string) => void
  /** Drop `froms` just before or after `target` (moving them to target's folder first if needed). */
  place: (froms: string[], target: TreeEntry, where: 'before' | 'after', siblings: TreeEntry[]) => void
  /** Multi-select: ⌘/Ctrl-click toggles, Shift-click selects the range from the last one. */
  selected: Set<string>
  select: (path: string, mode: 'toggle' | 'range' | 'only') => void
  clearSelection: () => void
  removeMany: (paths: string[]) => void
}

/** Drop paths inside another selected folder: acting on the folder covers them. */
const topLevel = (paths: string[]) => paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(`${q}/`)))

/** The paths being dragged: the whole selection when the dragged item is part of it. */
const draggedPaths = (dt: DataTransfer): string[] => {
  try {
    const many = JSON.parse(dt.getData('text/zync-paths') || '[]')
    if (Array.isArray(many) && many.length) return many
  } catch {}
  const one = dt.getData('text/zync-path')
  return one ? [one] : []
}

type DropZone = 'before' | 'after' | 'into'

export function SideTree({
  ws,
  data,
  creating,
  setCreating,
}: {
  ws: string
  data: WorkspaceData
  creating: Creating | null
  setCreating: (c: Creating | null) => void
}) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const shell = useShell()
  const [pathname, search = ''] = shell.activePath.split('?')
  const uploadRef = useRef<HTMLInputElement>(null)
  const folderUploadRef = useRef<HTMLInputElement>(null)
  const uploadBtn = useRef<HTMLButtonElement>(null)
  const [uploadMenu, setUploadMenu] = useState(false)
  const closeUploadMenu = useCallback(() => setUploadMenu(false), [])
  const [targetDir, setTargetDir] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [collapseKey, setCollapseKey] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const anchor = useRef<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  // A new workspace or a collapse starts over.
  useEffect(() => {
    setSelected(new Set())
    anchor.current = null
  }, [ws, collapseKey])
  /** Items as shown, top to bottom (only expanded folders' children). */
  const visiblePaths = () =>
    [...(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"][data-path]') ?? [])].map(
      (el) => el.dataset.path as string,
    )
  const [menu, setMenu] = useState<{ entry: TreeEntry; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  useDismiss(menuRef, !!menu, closeMenu)

  const filesPrefix = `${wsUrl(ws)}/files/`
  const boardsPrefix = `${wsUrl(ws)}/boards/`
  const decode = (p: string) => p.split('/').map(decodeURIComponent).join('/')
  const current = pathname.startsWith(filesPrefix) ? decode(pathname.slice(filesPrefix.length)) : ''
  const currentBoard = pathname.startsWith(boardsPrefix) ? decode(pathname.slice(boardsPrefix.length)) : ''
  const currentDir =
    pathname === `${wsUrl(ws)}/files` ? (new URLSearchParams(search ? `?${search}` : '').get('dir') ?? '') : ''

  const refresh = (dir: string) => {
    qc.invalidateQueries({ queryKey: ['tree', ws, dir] })
    qc.invalidateQueries({ queryKey: ['recent', ws] })
  }
  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const cardCount = new Map<string, number>()
  const cardAi = new Map<string, 'running' | 'done' | undefined>()
  for (const c of data.cards) {
    cardCount.set(c.board.path, (cardCount.get(c.board.path) ?? 0) + 1)
    const s = c.card.ai?.state
    if (s === 'running' || s === 'done') cardAi.set(c.ref, s)
  }

  const boardSet = new Set(data.boards.map((b) => b.path))
  const ctx: Ctx = {
    ws,
    current,
    currentBoard,
    currentDir,
    boards: boardSet,
    cardCount,
    cardAi,
    creating,
    renaming,
    open: (e, beside) => {
      const url =
        e.type === 'file' ? fileUrl(ws, e.path) : boardSet.has(e.path) ? boardUrl(ws, e.path) : folderUrl(ws, e.path)
      if (beside) shell.openBeside(url)
      else shell.open(url)
    },
    selectDir: setTargetDir,
    menu: (entry, x, y) => setMenu({ entry, x, y }),
    create: (raw) =>
      run(async () => {
        const c = creating
        setCreating(null)
        const name = raw.trim()
        if (!c || !name) return
        if (c.kind === 'folder') {
          await api.mkdir(ws, joinPath(c.dir, name))
          refresh(c.dir)
          return
        }
        const p = joinPath(c.dir, /\.[^/]+$/.test(name) ? name : `${name}.md`)
        await api.save(ws, p, p.endsWith('.md') ? `# ${basename(p).replace(/\.md$/, '')}\n` : '')
        refresh(c.dir)
        shell.open(fileUrl(ws, p))
      }),
    cancelCreate: () => setCreating(null),
    startRename: (e) => setRenaming(e.path),
    cancelRename: () => setRenaming(null),
    rename: (entry, raw) =>
      run(async () => {
        setRenaming(null)
        const name = raw.trim()
        if (!name || name === entry.name) return
        const to = joinPath(dirname(entry.path), name)
        await api.move(ws, entry.path, to)
        refresh(dirname(entry.path))
        if (current === entry.path) shell.open(fileUrl(ws, to))
      }),
    remove: (entry) =>
      run(async () => {
        const ok = await confirm({
          title: `Delete ${entry.name}?`,
          body: (
            <>
              <span className="mono-s">{entry.path}</span>
              {entry.type === 'dir' ? ' and everything inside it are' : ' is'} deleted from disk. This cannot be undone.
            </>
          ),
          confirmLabel: 'Delete',
          destructive: true,
        })
        if (!ok) return
        await api.remove(ws, entry.path)
        refresh(dirname(entry.path))
        if (current === entry.path || current.startsWith(`${entry.path}/`)) shell.open(wsUrl(ws, 'files'))
      }),
    moveInto: (froms, dir) =>
      run(async () => {
        for (const from of topLevel(froms)) {
          const to = joinPath(dir, basename(from))
          if (to === from || dir === from || dir.startsWith(`${from}/`)) continue
          await api.move(ws, from, to)
          refresh(dirname(from))
          if (current === from) shell.open(fileUrl(ws, to))
        }
        refresh(dir)
        setSelected(new Set())
      }),
    place: (froms, target, where, siblings) =>
      run(async () => {
        const dir = dirname(target.path)
        const moving = topLevel(froms).filter((f) => f !== target.path && dir !== f && !dir.startsWith(`${f}/`))
        if (!moving.length) return
        for (const from of moving) {
          if (dirname(from) === dir) continue
          await api.move(ws, from, joinPath(dir, basename(from)))
          refresh(dirname(from))
          if (current === from) shell.open(fileUrl(ws, joinPath(dir, basename(from))))
        }
        const placed = moving.map(basename)
        const names = siblings.map((e) => e.name).filter((n) => !placed.includes(n))
        names.splice(names.indexOf(target.name) + (where === 'after' ? 1 : 0), 0, ...placed)
        // Show the new order right away; the refetch confirms it.
        qc.setQueriesData<{ path: string; entries: TreeEntry[] }>({ queryKey: ['tree', ws, dir] }, (old) => {
          if (!old) return old
          const rank = new Map(names.map((n, i) => [n, i]))
          const entries = [...old.entries].sort(
            (a, b) => (rank.get(a.name) ?? names.length) - (rank.get(b.name) ?? names.length),
          )
          return { ...old, entries }
        })
        await api.setOrder(ws, dir, names)
        refresh(dir)
        setSelected(new Set())
      }),
    selected,
    select: (path, mode) => {
      if (mode === 'range' && anchor.current) {
        const all = visiblePaths()
        const [a, b] = [all.indexOf(anchor.current), all.indexOf(path)].sort((x, y) => x - y)
        if (a >= 0) {
          setSelected(new Set(all.slice(a, b + 1)))
          return
        }
      }
      anchor.current = path
      setSelected((old) => {
        if (mode === 'only') return new Set([path])
        const next = new Set(old)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      })
    },
    clearSelection: () => {
      anchor.current = null
      setSelected(new Set())
    },
    removeMany: (paths) =>
      run(async () => {
        const items = topLevel(paths)
        if (!items.length) return
        const ok = await confirm({
          title: `Delete ${items.length} item${items.length === 1 ? '' : 's'}?`,
          body: (
            <>
              {items.slice(0, 6).map((p) => (
                <span key={p} className="mono-s" style={{ display: 'block' }}>
                  {p}
                </span>
              ))}
              {items.length > 6 && <span className="mono-s">…and {items.length - 6} more</span>}
              <span style={{ display: 'block', marginTop: 8 }}>
                Deleted from disk, folders with everything inside. This cannot be undone.
              </span>
            </>
          ),
          confirmLabel: `Delete ${items.length}`,
          destructive: true,
        })
        if (!ok) return
        const failed: string[] = []
        for (const p of items) {
          await api.remove(ws, p).catch(() => failed.push(p))
          refresh(dirname(p))
        }
        setSelected(new Set())
        anchor.current = null
        if (items.some((p) => current === p || current.startsWith(`${p}/`))) shell.open(wsUrl(ws, 'files'))
        if (failed.length) throw new Error(`Could not delete: ${failed.join(', ')}`)
      }),
  }

  return (
    <>
      <div className="sect">
        <span>Workspace tree</span>
        <span className="row g4">
          <button className="ibtn ibtn-s" aria-label="Collapse all" onClick={() => setCollapseKey((k) => k + 1)}>
            <IconChevUp />
          </button>
        </span>
      </div>
      {selected.size > 0 && (
        <div className="tbar sel-bar" role="toolbar" aria-label="Selection">
          <span className="grow">{selected.size} selected</span>
          <button className="danger-t" onClick={() => ctx.removeMany([...selected])}>
            [×] Delete
          </button>
          <button onClick={ctx.clearSelection} title="Esc">
            Clear
          </button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {selected.size ? `${selected.size} selected` : ''}
      </span>
      <div className="tbar" hidden={selected.size > 0}>
        <button onClick={() => setCreating({ dir: targetDir, kind: 'page' })}>[+] Page</button>
        <button onClick={() => setCreating({ dir: targetDir, kind: 'folder' })}>[+] Folder</button>
        <button
          ref={uploadBtn}
          aria-haspopup="menu"
          aria-expanded={uploadMenu}
          onClick={() => setUploadMenu((o) => !o)}
        >
          [↑] Upload
        </button>
        <Popover anchor={uploadBtn} open={uploadMenu} onClose={closeUploadMenu} className="menu">
          <div role="menu" aria-label="Upload">
            <button
              type="button"
              role="menuitem"
              className="mi"
              onClick={() => {
                closeUploadMenu()
                uploadRef.current?.click()
              }}
            >
              Files…
            </button>
            <button
              type="button"
              role="menuitem"
              className="mi"
              onClick={() => {
                closeUploadMenu()
                folderUploadRef.current?.click()
              }}
            >
              Folder…
            </button>
          </div>
        </Popover>
        {[uploadRef, folderUploadRef].map((ref) => (
          <input
            key={ref === uploadRef ? 'files' : 'folder'}
            ref={ref}
            type="file"
            multiple
            hidden
            // A folder picker: each file keeps its path inside the chosen folder.
            {...(ref === folderUploadRef ? { webkitdirectory: '' } : {})}
            onChange={(e) =>
              run(async () => {
                if (e.target.files?.length) await api.upload(ws, targetDir, e.target.files)
                e.target.value = ''
                refresh(targetDir)
              })
            }
          />
        ))}
      </div>
      {error && (
        <div className="help err" style={{ padding: '0 10px 6px' }}>
          {error}
        </div>
      )}
      <div
        className="tree"
        role="tree"
        aria-label="Workspace files"
        aria-multiselectable="true"
        ref={treeRef}
        key={collapseKey}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const froms = draggedPaths(e.dataTransfer)
          if (froms.length) ctx.moveInto(froms, '')
        }}
      >
        <Dir path="" depth={0} ctx={ctx} />
      </div>
      {menu && (
        <div ref={menuRef} className="menu pop fixed" style={{ top: menu.y, left: menu.x }} role="menu">
          <button
            className="mi"
            role="menuitem"
            onClick={() => {
              ctx.open(menu.entry, true)
              closeMenu()
            }}
          >
            <span className="grow">Open beside</span>
            <span className="kbd">⌥ click</span>
          </button>
          <button
            className="mi"
            role="menuitem"
            onClick={() => {
              ctx.startRename(menu.entry)
              closeMenu()
            }}
          >
            <span className="grow">Rename</span>
            <span className="kbd">F2</span>
          </button>
          {menu.entry.type === 'dir' && (
            <>
              <button
                className="mi"
                role="menuitem"
                onClick={() => {
                  setCreating({ dir: menu.entry.path, kind: 'page' })
                  closeMenu()
                }}
              >
                New page here
              </button>
              <button
                className="mi"
                role="menuitem"
                onClick={() => {
                  setCreating({ dir: menu.entry.path, kind: 'folder' })
                  closeMenu()
                }}
              >
                New folder here
              </button>
            </>
          )}
          <span className="sepline" />
          <button
            className="mi danger-t"
            role="menuitem"
            onClick={() => {
              if (selected.size > 1 && selected.has(menu.entry.path)) ctx.removeMany([...selected])
              else ctx.remove(menu.entry)
              closeMenu()
            }}
          >
            <span className="grow">
              {selected.size > 1 && selected.has(menu.entry.path) ? `Delete ${selected.size} items` : 'Delete'}
            </span>
            <span className="kbd">⌫</span>
          </button>
        </div>
      )}
    </>
  )
}

function depthProps(depth: number): { cls: string; style?: CSSProperties } {
  if (depth === 0) return { cls: '' }
  if (depth <= 2) return { cls: ` d${depth}` }
  return { cls: '', style: { paddingLeft: 22 + 18 * (depth - 1) } }
}

function Dir({ path, depth, ctx }: { path: string; depth: number; ctx: Ctx }) {
  const [hidden] = useShowHidden()
  const { data, error } = useQuery({
    queryKey: ['tree', ctx.ws, path, hidden],
    queryFn: () => api.tree(ctx.ws, path, hidden),
  })
  const creatingHere = ctx.creating?.dir === path
  if (error)
    return (
      <div className="help err" style={{ padding: '0 10px' }}>
        {(error as Error).message}
      </div>
    )
  return (
    <>
      {creatingHere && <NameInput depth={depth} ctx={ctx} />}
      {data?.entries.map((e) => (
        <Node key={e.path} entry={e} depth={depth} ctx={ctx} siblings={data.entries} />
      ))}
      {data && !data.entries.length && depth === 0 && !creatingHere && (
        <span className="ti muted">Empty workspace</span>
      )}
    </>
  )
}

function NameInput({ depth, ctx, entry }: { depth: number; ctx: Ctx; entry?: TreeEntry }) {
  const { cls, style } = depthProps(depth)
  const [v, setV] = useState(entry?.name ?? '')
  const done = useRef(false)
  const label = entry ? 'Rename' : ctx.creating?.kind === 'folder' ? 'New folder name' : 'New page name'
  const commit = () => {
    if (done.current) return
    done.current = true
    if (entry) ctx.rename(entry, v)
    else ctx.create(v)
  }
  const cancel = () => {
    if (done.current) return
    done.current = true
    if (entry) ctx.cancelRename()
    else ctx.cancelCreate()
  }
  return (
    <div className={`ti${cls} creating`} style={style}>
      <input
        aria-label={label}
        autoFocus
        value={v}
        placeholder={ctx.creating?.kind === 'folder' ? 'folder' : 'Untitled.md'}
        onFocus={(e) => {
          const dot = e.target.value.lastIndexOf('.')
          e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length)
        }}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        onBlur={() => (v.trim() && !entry ? commit() : cancel())}
      />
    </div>
  )
}

function Node({ entry, depth, ctx, siblings }: { entry: TreeEntry; depth: number; ctx: Ctx; siblings: TreeEntry[] }) {
  const isDir = entry.type === 'dir'
  const isBoard = isDir && ctx.boards.has(entry.path)
  const within = (p: string) => p === entry.path || p.startsWith(`${entry.path}/`)
  const [open, setOpen] = useState(() => within(ctx.current) || within(ctx.currentBoard) || within(ctx.currentDir))
  const [over, setOver] = useState<DropZone | null>(null)
  const isSelected = ctx.selected.has(entry.path)
  const creatingInside = !!ctx.creating && within(ctx.creating.dir)
  useEffect(() => {
    if (creatingInside) setOpen(true)
  }, [creatingInside])

  if (ctx.renaming === entry.path) return <NameInput depth={depth} ctx={ctx} entry={entry} />

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
            ctx.select(paths[0], 'only')
            ctx.select(paths[paths.length - 1], 'range')
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
      {isDir && open && <Dir path={entry.path} depth={depth + 1} ctx={ctx} />}
    </>
  )
}
