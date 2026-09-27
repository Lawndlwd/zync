import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api'
import { ago } from '../helpers/dates'
import { boardUrl, folderUrl } from '../helpers/urls'
import { IconBoard, IconFolder } from '../icons'
import type { TreeEntry } from '../types/files'

/** One folder box: name, what's inside, last change. Board folders open the board. */
export function FolderBox({ ws, folder, isBoard }: { ws: string; folder: TreeEntry; isBoard: boolean }) {
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
