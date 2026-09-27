import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { IconButton } from '../components/IconButton'
import { IconPin, IconTrash } from '../icons'
import type { Memory } from '../types/memory'
import { TYPE_INFO } from './helpers'

export function MemoryList({
  title,
  meta,
  items,
  total,
  openFile,
  onOpen,
  onDelete,
  onNew,
}: {
  title: string
  meta: string
  items: Memory[]
  total: number
  openFile?: string
  onOpen: (m: Memory) => void
  onDelete: (m: Memory) => void
  onNew: () => void
}) {
  return (
    <Card title={`${title} · ${total}`} meta={meta}>
      <div className="col">
        {items.map((m) => (
          <div key={m.file} className={`lr row-link mem-row${openFile === m.file ? ' hl' : ''}`}>
            <button
              type="button"
              className="row g10 grow"
              style={{ textAlign: 'left', alignItems: 'flex-start', minWidth: 0 }}
              onClick={() => onOpen(m)}
            >
              <span className="col grow g4" style={{ minWidth: 0 }}>
                <span className="row g8">
                  {m.pinned && <IconPin />}
                  <b style={{ fontWeight: 500 }} className="trunc">
                    {m.title}
                  </b>
                </span>
                <span className="small muted clamp2">{m.description || m.body.slice(0, 160) || 'Empty'}</span>
              </span>
              {m.type && <span className="label alt">{TYPE_INFO[m.type].label}</span>}
              <span className="mono-s muted" style={{ whiteSpace: 'nowrap', paddingTop: 3 }}>
                {new Date(m.updated).toLocaleDateString()}
              </span>
            </button>
            <IconButton small label={`Delete ${m.title}`} className="mem-del" onClick={() => onDelete(m)}>
              <IconTrash />
            </IconButton>
          </div>
        ))}
        {!items.length && (
          <div className="lr small muted between">
            <span>{total ? 'Nothing matches.' : 'Nothing yet. The AI adds memories as it learns, or add one.'}</span>
            {!total && (
              <Button size="sm" onClick={onNew}>
                Add
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
