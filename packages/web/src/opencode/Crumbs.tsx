import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Breadcrumbs } from '../components/Breadcrumbs'
import { libraryUrl } from '../helpers/urls'

export function Crumbs({ ws, parts, status }: { ws: string; parts: string[]; status?: ReactNode }) {
  return (
    <div className="row between g12 wrap">
      <Breadcrumbs
        root={
          <Link to={libraryUrl(ws)} className="link muted">
            OpenCode
          </Link>
        }
        parts={parts}
        label="Breadcrumb"
      />
      {status}
    </div>
  )
}
