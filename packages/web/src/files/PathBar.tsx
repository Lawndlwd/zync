import type { ReactNode } from 'react'

import { api } from '../api'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { basename } from '../helpers/paths'

export function PathBar({ ws, path, status }: { ws: string; path: string; status?: ReactNode }) {
  return (
    <div className="pathbar">
      <Breadcrumbs root={<span>{ws}</span>} parts={path.split('/')} label="Path" />
      <div className="row g12">
        {status}
        {status && <span style={{ width: 1, height: 18, borderLeft: '1px dashed var(--line)' }} />}
        <a href={api.rawUrl(ws, path)} target="_blank" rel="noreferrer" className="link">
          [Raw ↗]
        </a>
        <a href={api.rawUrl(ws, path)} download={basename(path)} className="link">
          [Download]
        </a>
      </div>
    </div>
  )
}
