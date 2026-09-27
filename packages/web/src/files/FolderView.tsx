import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, type TreeEntry } from '../api'
import { boardUrl } from '../boards/shared'
import { Button } from '../components/Button'
import { IconBoard, IconFile, IconFolder, IconPlus } from '../icons'
import { fileUrl, useShell, useShowHidden, wsUrl } from '../shell/context'
import { Card } from '../ui'
import { ago } from '../workspaceData'

const RECENT = 5

export const folderUrl = (ws: string, dir: string) => wsUrl(ws, dir ? `files?dir=${encodeURIComponent(dir)}` : 'files')

/**
 * A folder as a page: its subfolders as boxes, then files. At the workspace root the files are the
 * 5 most recently edited anywhere; inside a folder they're that folder's own files, newest first.
 */
export function FolderView({ ws, dir }: { ws: string; dir: string }) {
  const shell = useShell()
  const [hidden] = useShowHidden()
  const tree = useQuery({ queryKey: ['tree', ws, dir, hidden], queryFn: () => api.tree(ws, dir, hidden) })
  const recent = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100), enabled: !dir })
  const boards = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) }).data ?? []
  const entries = tree.data?.entries ?? []
  const folders = entries.filter((e) => e.type === 'dir')
  const files = dir
    ? entries.filter((e) => e.type === 'file').sort((a, b) => b.mtime - a.mtime)
    : (recent.data?.entries ?? []).slice(0, RECENT)
  const parts = dir ? dir.split('/') : []
  const name = parts.at(-1) ?? 'Files'

  return (
    <div className="page col g24">
      <div className="col g16">
        <nav className="mono muted row g8 wrap" aria-label="Path">
          <Link to={folderUrl(ws, '')} className="link muted">
            {ws}
          </Link>
          {parts.map((p, i) => (
            <span key={parts.slice(0, i + 1).join('/')} className="row g8">
              <span>/</span>
              {i === parts.length - 1 ? (
                <span style={{ color: 'var(--ink)' }}>{p}</span>
              ) : (
                <Link to={folderUrl(ws, parts.slice(0, i + 1).join('/'))} className="link muted">
                  {p}
                </Link>
              )}
            </span>
          ))}
          {!dir && <span>/ files</span>}
        </nav>
        <div className="row between wrap g16" style={{ alignItems: 'flex-end' }}>
          <div className="col g12">
            <h1 className="display">{name}</h1>
            <p className="lede">
              {dir ? (
                <>
                  <b>{folders.length}</b> {folders.length === 1 ? 'folder' : 'folders'} ·{' '}
                  <b>{entries.length - folders.length}</b> {entries.length - folders.length === 1 ? 'file' : 'files'}
                </>
              ) : (
                <>
                  Everything in this workspace is a plain file — <b>{recent.data?.total ?? 0} files</b>.
                </>
              )}
            </p>
          </div>
          <span className="row g8">
            <Button variant="soft" onClick={() => shell.startCreate({ dir, kind: 'folder' })}>
              [+] Folder
            </Button>
            <Button variant="primary" onClick={() => shell.startCreate({ dir, kind: 'page' })}>
              <IconPlus size={12} sw={1.8} />
              New page
            </Button>
          </span>
        </div>
      </div>

      {tree.error && <p className="help err">{(tree.error as Error).message}</p>}

      <Card title="Folders" meta={tree.data ? `${folders.length}` : ''}>
        {!tree.data ? (
          <div className="folder-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skel" style={{ height: 92 }} />
            ))}
          </div>
        ) : folders.length ? (
          <div className="folder-grid">
            {folders.map((f) => (
              <FolderBox key={f.path} ws={ws} folder={f} isBoard={boards.some((b) => b.path === f.path)} />
            ))}
          </div>
        ) : (
          <span className="small muted">No folders{dir ? ' here' : ' yet'}.</span>
        )}
      </Card>

      <Card
        title={dir ? 'Files' : 'Recent files'}
        meta={dir ? `${files.length}` : `${files.length} of ${recent.data?.total ?? 0}`}
      >
        <div className="col">
          {!files.length && <span className="lr small muted">No files{dir ? ' in this folder' : ' yet'}.</span>}
          {files.map((f) => {
            const i = f.path.lastIndexOf('/')
            return (
              <Link key={f.path} to={fileUrl(ws, f.path)} className="lr row-link">
                <IconFile size={15} sw={1.3} />
                <span className="grow trunc">
                  {!dir && i > 0 && <span className="muted">{f.path.slice(0, i + 1)}</span>}
                  {f.name}
                </span>
                <span className="mono-s muted" style={{ width: 96 }}>
                  {ago(new Date(f.mtime))}
                </span>
                <span className="link">[Open ↗]</span>
              </Link>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/** One folder box: name, what's inside, last change. Board folders open the board. */
function FolderBox({ ws, folder, isBoard }: { ws: string; folder: TreeEntry; isBoard: boolean }) {
  const [inside] = useQueries({
    queries: [{ queryKey: ['tree', ws, folder.path], queryFn: () => api.tree(ws, folder.path) }],
  })
  const items = inside.data?.entries ?? []
  const subdirs = items.filter((e) => e.type === 'dir').length
  const files = items.length - subdirs
  const latest = items.reduce((m, e) => Math.max(m, e.mtime), folder.mtime)
  const summary = inside.data
    ? [
        subdirs && `${subdirs} ${subdirs === 1 ? 'folder' : 'folders'}`,
        `${files} ${isBoard ? (files === 1 ? 'card' : 'cards') : files === 1 ? 'file' : 'files'}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '…'

  return (
    <Link to={isBoard ? boardUrl(ws, folder.path) : folderUrl(ws, folder.path)} className="folder-box">
      <span className="row between">
        {isBoard ? <IconBoard size={18} sw={1.3} /> : <IconFolder size={18} />}
        {isBoard && <span className="label">Board</span>}
      </span>
      <span className="folder-name trunc">{folder.name}</span>
      <span className="row between mono-s muted">
        <span className="trunc">{summary}</span>
        <span>{ago(new Date(latest))}</span>
      </span>
    </Link>
  )
}
