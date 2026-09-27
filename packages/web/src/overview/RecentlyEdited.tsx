import { Link } from 'react-router'

import { Card } from '../components/Card'
import { ago } from '../helpers/dates'
import { dirname } from '../helpers/paths'
import { fileUrl, wsUrl } from '../helpers/urls'
import { IconBoard, IconFile, IconSpark, IconSpin } from '../icons'
import type { WorkspaceData } from '../types/workspace'

export function RecentlyEdited({ ws, data, now }: { ws: string; data: WorkspaceData; now: Date }) {
  const boards = new Set(data.boards.map((b) => b.path))
  const byRef = new Map(data.cards.map((c) => [c.ref, c]))
  return (
    <Card
      title="Recently edited"
      meta={
        <Link to={wsUrl(ws, 'files')} className="link">
          [All files ↗]
        </Link>
      }
      className="c-recent"
    >
      <div className="col">
        {!data.recent.length && <span className="lr small muted">No files yet.</span>}
        {data.recent.slice(0, 4).map((f) => {
          const i = f.path.lastIndexOf('/')
          const dir = i < 0 ? '' : f.path.slice(0, i + 1)
          const card = byRef.get(f.path)
          const inBoard = boards.has(dirname(f.path))
          const ai = card?.card.ai
          const aiWriting = ai?.state === 'running'
          // "Edited by AI" only when the file's last write is the AI run finishing, not a later edit.
          const aiEdited =
            ai?.state === 'done' && ai.finishedAt && Math.abs(new Date(ai.finishedAt).getTime() - f.mtime) < 5 * 60_000
          return (
            <div key={f.path} className="lr">
              {inBoard ? <IconBoard size={15} sw={1.3} /> : <IconFile size={15} sw={1.3} />}
              <span className="grow trunc">
                {dir && <span className="muted">{dir}</span>}
                {f.name}
              </span>
              {aiWriting ? (
                <span className="aimark">
                  <IconSpin size={10} sw={2.2} />
                  AI writing
                </span>
              ) : aiEdited ? (
                <span className="aimark">
                  <IconSpark size={10} />
                  Edited by AI
                </span>
              ) : null}
              {(aiWriting || aiEdited) && <span className="sep">|</span>}
              <span className="mono-s muted" style={{ width: 96 }}>
                {aiWriting ? 'Now' : ago(new Date(f.mtime), now)}
              </span>
              <Link to={fileUrl(ws, f.path)} className="link">
                [Open ↗]
              </Link>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
