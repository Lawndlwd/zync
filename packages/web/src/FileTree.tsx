import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api, basename, dirname, joinPath, type TreeEntry } from './api'

function useCurrentFile(ws: string): string {
  const { pathname } = useLocation()
  const prefix = `/w/${encodeURIComponent(ws)}/files/`
  return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : ''
}

export function FileTree({ ws }: { ws: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const current = useCurrentFile(ws)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [targetDir, setTargetDir] = useState('')
  const [error, setError] = useState('')

  const refresh = (dir: string) => qc.invalidateQueries({ queryKey: ['tree', ws, dir] })
  const open = (p: string) =>
    navigate(`/w/${encodeURIComponent(ws)}/files/${p.split('/').map(encodeURIComponent).join('/')}`)
  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const actions: TreeActions = {
    ws,
    current,
    open,
    selectDir: setTargetDir,
    rename: (entry) =>
      run(async () => {
        const name = prompt('Rename to', entry.name)?.trim()
        if (!name || name === entry.name) return
        const to = joinPath(dirname(entry.path), name)
        await api.move(ws, entry.path, to)
        refresh(dirname(entry.path))
        if (current === entry.path) open(to)
      }),
    remove: (entry) =>
      run(async () => {
        if (!confirm(`Delete ${entry.path}${entry.type === 'dir' ? ' and everything inside' : ''}?`)) return
        await api.remove(ws, entry.path)
        refresh(dirname(entry.path))
        if (current === entry.path || current.startsWith(`${entry.path}/`))
          navigate(`/w/${encodeURIComponent(ws)}/files`)
      }),
    moveInto: (from, dir) =>
      run(async () => {
        const to = joinPath(dir, basename(from))
        if (to === from) return
        await api.move(ws, from, to)
        refresh(dirname(from))
        refresh(dir)
        if (current === from) open(to)
      }),
  }

  const newFile = () =>
    run(async () => {
      const name = prompt(`New page in /${targetDir}`, 'Untitled.md')?.trim()
      if (!name) return
      const p = joinPath(targetDir, /\.[^/]+$/.test(name) ? name : `${name}.md`)
      await api.save(
        ws,
        p,
        name.endsWith('.md') || !/\.[^/]+$/.test(name) ? `# ${basename(p).replace(/\.md$/, '')}\n` : '',
      )
      refresh(targetDir)
      open(p)
    })

  const newFolder = () =>
    run(async () => {
      const name = prompt(`New folder in /${targetDir}`)?.trim()
      if (!name) return
      await api.mkdir(ws, joinPath(targetDir, name))
      refresh(targetDir)
    })

  return (
    <div className="tree">
      <div className="tree-toolbar">
        <span className="muted" title="New items go here">
          /{targetDir}
        </span>
        <button onClick={newFile} title="New page">
          + Page
        </button>
        <button onClick={newFolder} title="New folder">
          + Folder
        </button>
        <button onClick={() => uploadRef.current?.click()} title="Upload files">
          ⇪
        </button>
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
      {error && <div className="error small">{error}</div>}
      <div
        className="tree-root"
        onClick={() => setTargetDir('')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const from = e.dataTransfer.getData('text/zync-path')
          if (from) actions.moveInto(from, '')
        }}
      >
        <Dir path="" depth={0} actions={actions} />
      </div>
    </div>
  )
}

interface TreeActions {
  ws: string
  current: string
  open: (p: string) => void
  selectDir: (p: string) => void
  rename: (e: TreeEntry) => void
  remove: (e: TreeEntry) => void
  moveInto: (from: string, dir: string) => void
}

function Dir({ path, depth, actions }: { path: string; depth: number; actions: TreeActions }) {
  const { data, error } = useQuery({ queryKey: ['tree', actions.ws, path], queryFn: () => api.tree(actions.ws, path) })
  if (error) return <div className="error small">{String((error as Error).message)}</div>
  if (!data) return null
  if (!data.entries.length && depth === 0) return <div className="muted small pad">Empty workspace</div>
  return (
    <>
      {data.entries.map((e) => (
        <Node key={e.path} entry={e} depth={depth} actions={actions} />
      ))}
    </>
  )
}

function Node({ entry, depth, actions }: { entry: TreeEntry; depth: number; actions: TreeActions }) {
  const isOpenPath = actions.current.startsWith(`${entry.path}/`)
  const [open, setOpen] = useState(isOpenPath)
  const [over, setOver] = useState(false)
  const isDir = entry.type === 'dir'
  const active = actions.current === entry.path

  return (
    <div>
      <div
        className={`node ${active ? 'active' : ''} ${over ? 'drop' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
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
          if (from && from !== entry.path) actions.moveInto(from, entry.path)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (isDir) {
            setOpen((o) => !o)
            actions.selectDir(entry.path)
          } else {
            actions.selectDir(dirname(entry.path))
            actions.open(entry.path)
          }
        }}
      >
        <span className="icon">{isDir ? (open ? '▾' : '▸') : '·'}</span>
        <span className="label">{entry.name}</span>
        <span className="node-actions">
          <button
            title="Rename"
            onClick={(e) => {
              e.stopPropagation()
              actions.rename(entry)
            }}
          >
            ✎
          </button>
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              actions.remove(entry)
            }}
          >
            ✕
          </button>
        </span>
      </div>
      {isDir && open && <Dir path={entry.path} depth={depth + 1} actions={actions} />}
    </div>
  )
}
