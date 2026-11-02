import { useNavigate } from 'react-router'

import { MirrorView } from '../becoming/MirrorView'
import { basename } from '../helpers/paths'
import { wsUrl } from '../helpers/urls'
import { PathBar } from './PathBar'

/** A page in Becoming/Mirror/ is a week's Mirror: opened in Files, it reads like on the Becoming page. */
export function MirrorFile({ ws, path }: { ws: string; path: string }) {
  const navigate = useNavigate()
  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} />
      <div className="page file-page">
        <MirrorView
          ws={ws}
          week={basename(path).replace(/\.md$/, '')}
          onWeek={(w) => void navigate(`${wsUrl(ws, 'becoming')}?tab=mirror&week=${encodeURIComponent(w)}`)}
        />
      </div>
    </div>
  )
}
