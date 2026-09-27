import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { api } from '../api'
import { useConfirm } from '../components/Dialog'
import { Popover } from '../components/Popover'
import { errorMessage, plural } from '../helpers/format'
import { basename, decodePath, dirname, joinPath } from '../helpers/paths'
import { boardUrl, fileUrl, folderUrl, wsUrl } from '../helpers/urls'
import { useDismiss } from '../hooks/useDismiss'
import { IconChevUp } from '../icons'
import type { TreeEntry } from '../types/files'
import type { Creating, TreeCtx } from '../types/shell'
import type { WorkspaceData } from '../types/workspace'
import { draggedPaths, topLevel } from './helpers'
import { splitPath } from './paneUrl'
import { useShell } from './ShellContext'
import { TreeDir } from './TreeDir'

// The workspace folder tree in the sidebar. Same folders everywhere: board folders open the board,
// files open the editor. Right-click (or F2 / Delete on a focused row) to rename, delete, create.

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
  const { pathname, search } = splitPath(shell.activePath)
  const uploadRef = useRef<HTMLInputElement>(null)
  const folderUploadRef = useRef<HTMLInputElement>(null)
  const uploadBtn = useRef<HTMLButtonElement>(null)
  const [uploadMenu, setUploadMenu] = useState(false)
  const closeUploadMenu = () => setUploadMenu(false)
  const [targetDir, setTargetDir] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [collapseKey, setCollapseKey] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  // Where a shift-click range starts.
  const [anchor, setAnchor] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  // A new workspace or a collapse starts over.
  const resetKey = `${ws}\n${collapseKey}`
  const [selectionFor, setSelectionFor] = useState(resetKey)
  if (selectionFor !== resetKey) {
    setSelectionFor(resetKey)
    setSelected(new Set())
    setAnchor(null)
  }
  /** Items as shown, top to bottom (only expanded folders' children). */
  const visiblePaths = () =>
    [...(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"][data-path]') ?? [])].map(
      (el) => el.dataset.path ?? '',
    )
  const [menu, setMenu] = useState<{ entry: TreeEntry; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = () => setMenu(null)
  useDismiss(menuRef, !!menu, closeMenu)

  const filesPrefix = `${wsUrl(ws)}/files/`
  const boardsPrefix = `${wsUrl(ws)}/boards/`
  const current = pathname.startsWith(filesPrefix) ? decodePath(pathname.slice(filesPrefix.length)) : ''
  const currentBoard = pathname.startsWith(boardsPrefix) ? decodePath(pathname.slice(boardsPrefix.length)) : ''
  const currentDir =
    pathname === `${wsUrl(ws)}/files` ? (new URLSearchParams(search ? `?${search}` : '').get('dir') ?? '') : ''

  const refresh = (dir: string) => {
    void qc.invalidateQueries({ queryKey: ['tree', ws, dir] })
    void qc.invalidateQueries({ queryKey: ['recent', ws] })
  }
  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err))
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
  const ctx: TreeCtx = {
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
      void run(async () => {
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
      void run(async () => {
        setRenaming(null)
        const name = raw.trim()
        if (!name || name === entry.name) return
        const to = joinPath(dirname(entry.path), name)
        await api.move(ws, entry.path, to)
        refresh(dirname(entry.path))
        if (current === entry.path) shell.open(fileUrl(ws, to))
      }),
    remove: (entry) =>
      void run(async () => {
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
      void run(async () => {
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
      void run(async () => {
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
          const entries = [...old.entries].toSorted(
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
      if (mode === 'range' && anchor) {
        const all = visiblePaths()
        const [a = -1, b = -1] = [all.indexOf(anchor), all.indexOf(path)].toSorted((x, y) => x - y)
        if (a >= 0) {
          setSelected(new Set(all.slice(a, b + 1)))
          return
        }
      }
      setAnchor(path)
      setSelected((old) => {
        if (mode === 'only') return new Set([path])
        const next = new Set(old)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      })
    },
    clearSelection: () => {
      setAnchor(null)
      setSelected(new Set())
    },
    removeMany: (paths) =>
      void run(async () => {
        const items = topLevel(paths)
        if (!items.length) return
        const ok = await confirm({
          title: `Delete ${plural(items.length, 'item')}?`,
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
        setAnchor(null)
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
        {(['files', 'folder'] as const).map((kind) => (
          <input
            key={kind}
            ref={kind === 'files' ? uploadRef : folderUploadRef}
            type="file"
            multiple
            hidden
            // A folder picker: each file keeps its path inside the chosen folder.
            {...(kind === 'folder' ? { webkitdirectory: '' } : {})}
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
        tabIndex={-1}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const froms = draggedPaths(e.dataTransfer)
          if (froms.length) ctx.moveInto(froms, '')
        }}
      >
        <TreeDir path="" depth={0} ctx={ctx} />
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
