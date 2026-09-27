import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ago } from '../helpers/dates'
import { fileUrl, folderUrl } from '../helpers/urls'
import { useShowHidden } from '../hooks/useShowHidden'
import { IconFile, IconPlus } from '../icons'
import { useShell } from '../shell/ShellContext'
import { FolderBox } from './FolderBox'

const RECENT = 5

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
    ? entries.filter((e) => e.type === 'file').toSorted((a, b) => b.mtime - a.mtime)
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
            <Button variant="primary" data-tour="new-page" onClick={() => shell.startCreate({ dir, kind: 'page' })}>
              <IconPlus size={12} sw={1.8} />
              New page
            </Button>
          </span>
        </div>
      </div>

      {tree.error && <p className="help err">{tree.error.message}</p>}

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
