import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api, basename, dirname, joinPath, type TreeEntry } from '../api'
import { boardUrl } from '../boards/shared'
import { useConfirm } from '../components/Dialog'
import { IconBoard, IconChevDown, IconChevRight, IconChevUp, IconFile, IconFolder, IconPlus, IconSpin } from '../icons'
import { useDismiss } from '../ui'
import type { WorkspaceData } from '../workspaceData'
import { type Creating, fileUrl, wsUrl } from './context'

// The workspace folder tree in the sidebar. Same folders everywhere: board folders open the board,
// files open the editor. Right-click (or F2 / Delete on a focused row) to rename, delete, create.

interface Ctx {
  ws: string
  current: string
  currentBoard: string
  boards: Set<string>
  cardCount: Map<string, number>
  cardAi: Map<string, 'running' | 'done' | undefined>
  creating: Creating | null
  renaming: string | null
  open: (e: TreeEntry) => void
  selectDir: (dir: string) => void
  menu: (e: TreeEntry, x: number, y: number) => void
  create: (name: string) => void
  cancelCreate: () => void
  rename: (e: TreeEntry, name: string) => void
  cancelRename: () => void
  startRename: (e: TreeEntry) => void
  remove: (e: TreeEntry) => void
  moveInto: (from: string, dir: string) => void
}

export function SideTree({
  ws,
  data,
  toolbar,
  creating,
  setCreating,
}: {
  ws: string
  data: WorkspaceData
  toolbar: boolean
  creating: Creating | null
  setCreating: (c: Creating | null) => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { pathname } = useLocation()
  const uploadRef = useRef<HTMLInputElement>(null)
  const [targetDir, setTargetDir] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [collapseKey, setCollapseKey] = useState(0)
  const [menu, setMenu] = useState<{ entry: TreeEntry; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  useDismiss(menuRef, !!menu, closeMenu)

  const filesPrefix = `${wsUrl(ws)}/files/`
  const boardsPrefix = `${wsUrl(ws)}/boards/`
  const decode = (p: string) => p.split('/').map(decodeURIComponent).join('/')
  const current = pathname.startsWith(filesPrefix) ? decode(pathname.slice(filesPrefix.length)) : ''
  const currentBoard = pathname.startsWith(boardsPrefix) ? decode(pathname.slice(boardsPrefix.length)) : ''

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

  const ctx: Ctx = {
    ws,
    current,
    currentBoard,
    boards: new Set(data.boards.map((b) => b.path)),
    cardCount,
    cardAi,
    creating,
    renaming,
    open: (e) => {
      if (e.type === 'dir') navigate(boardUrl(ws, e.path))
      else navigate(fileUrl(ws, e.path))
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
        navigate(fileUrl(ws, p))
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
        if (current === entry.path) navigate(fileUrl(ws, to))
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
        if (current === entry.path || current.startsWith(`${entry.path}/`)) navigate(wsUrl(ws, 'files'))
      }),
    moveInto: (from, dir) =>
      run(async () => {
        const to = joinPath(dir, basename(from))
        if (to === from || dir.startsWith(`${from}/`)) return
        await api.move(ws, from, to)
        refresh(dirname(from))
        refresh(dir)
        if (current === from) navigate(fileUrl(ws, to))
      }),
  }

  return (
    <>
      <div className="sect">
        <span>Workspace tree</span>
        <span className="row g4">
          {toolbar ? (
            <button className="ibtn ibtn-s" aria-label="Collapse all" onClick={() => setCollapseKey((k) => k + 1)}>
              <IconChevUp />
            </button>
          ) : (
            <button
              className="ibtn ibtn-s"
              aria-label="New page"
              onClick={() => setCreating({ dir: targetDir, kind: 'page' })}
            >
              <IconPlus />
            </button>
          )}
        </span>
      </div>
      {toolbar && (
        <div className="tbar">
          <button onClick={() => setCreating({ dir: targetDir, kind: 'page' })}>[+] Page</button>
          <button onClick={() => setCreating({ dir: targetDir, kind: 'folder' })}>[+] Folder</button>
          <button onClick={() => uploadRef.current?.click()}>[↑] Upload</button>
          <input
            ref={uploadRef}
            type="file"
            multiple
            hidden
            onChange={(e) =>
              run(async () => {
                if (e.target.files?.length) await api.upload(ws, targetDir, e.target.files)
                e.target.value = ''
                refresh(targetDir)
              })
            }
          />
        </div>
      )}
      {error && (
        <div className="help err" style={{ padding: '0 10px 6px' }}>
          {error}
        </div>
      )}
      <div
        className="tree"
        role="tree"
        aria-label="Workspace files"
        key={collapseKey}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const from = e.dataTransfer.getData('text/zync-path')
          if (from) ctx.moveInto(from, '')
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
              ctx.remove(menu.entry)
              closeMenu()
            }}
          >
            Delete
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
  const { data, error } = useQuery({ queryKey: ['tree', ctx.ws, path], queryFn: () => api.tree(ctx.ws, path) })
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
        <Node key={e.path} entry={e} depth={depth} ctx={ctx} />
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

function Node({ entry, depth, ctx }: { entry: TreeEntry; depth: number; ctx: Ctx }) {
  const isDir = entry.type === 'dir'
  const isBoard = isDir && ctx.boards.has(entry.path)
  const within = (p: string) => p === entry.path || p.startsWith(`${entry.path}/`)
  const [open, setOpen] = useState(() => within(ctx.current) || within(ctx.currentBoard))
  const [over, setOver] = useState(false)
  const creatingInside = !!ctx.creating && within(ctx.creating.dir)
  useEffect(() => {
    if (creatingInside) setOpen(true)
  }, [creatingInside])

  if (ctx.renaming === entry.path) return <NameInput depth={depth} ctx={ctx} entry={entry} />

  const { cls, style } = depthProps(depth)
  const active = isBoard ? ctx.currentBoard === entry.path : ctx.current === entry.path
  const ai = ctx.cardAi.get(entry.path)
  const meta = isBoard ? (
    <span className="meta">{ctx.cardCount.get(entry.path) ?? ''}</span>
  ) : ai === 'running' ? (
    <span className="meta">
      <IconSpin size={10} sw={2.2} />
    </span>
  ) : ai === 'done' ? (
    <span className="meta">AI</span>
  ) : over ? (
    <span className="meta">drop to move</span>
  ) : null

  const onActivate = () => {
    if (isDir) {
      ctx.selectDir(entry.path)
      if (isBoard) {
        setOpen(true)
        ctx.open(entry)
      } else setOpen((o) => !o)
    } else {
      ctx.selectDir(dirname(entry.path))
      ctx.open(entry)
    }
  }

  return (
    <>
      <div
        className={`ti${cls}${active ? ' on' : ''}${over ? ' drop' : ''}`}
        style={style}
        role="treeitem"
        tabIndex={0}
        aria-selected={active}
        aria-expanded={isDir ? open : undefined}
        aria-current={active ? 'page' : undefined}
        title={entry.path}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.setData('text/zync-path', entry.path)
        }}
        onDragOver={(e) => {
          if (!isDir) return
          e.preventDefault()
          e.stopPropagation()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!isDir) return
          e.preventDefault()
          e.stopPropagation()
          setOver(false)
          const from = e.dataTransfer.getData('text/zync-path')
          if (from && from !== entry.path) ctx.moveInto(from, entry.path)
        }}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onActivate()
          if (e.key === 'F2') ctx.startRename(entry)
          if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) ctx.remove(entry)
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
