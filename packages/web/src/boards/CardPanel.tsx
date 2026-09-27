import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { statusOf } from '../helpers/boards'
import { fileUrl } from '../helpers/urls'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconChevDown, IconChevUp, IconCross } from '../icons'
import type { Board, Card, CardPatch, Draft } from '../types/boards'
import type { Person } from '../types/people'
import { CardDocument } from './CardDocument'
import { emptyDraft } from './helpers'

/**
 * The 480px side panel beside the board. It shows the card's file as a page (CardDocument); in
 * create mode the same page fills a draft and "Create card" writes the file.
 */
export function CardPanel({
  ws,
  board,
  cards,
  people,
  card,
  draft: initialDraft,
  onPatch,
  onCreate,
  onRun,
  onDelete,
  onClose,
  onStep,
  error,
  top,
  createLabel = 'Create card',
}: {
  ws: string
  board: Board
  cards: Card[]
  people: Person[]
  card?: Card
  draft?: Draft
  onPatch: (patch: CardPatch) => Promise<unknown>
  onCreate: (d: Draft) => Promise<unknown>
  onRun: () => Promise<unknown>
  onDelete: () => void
  onClose: () => void
  onStep?: (dir: -1 | 1) => void
  error: string
  /** Shown above the page (e.g. the calendar's "Event / Card" switch). */
  top?: ReactNode
  createLabel?: string
}) {
  const creating = !card
  const [draft, setDraft] = useState<Draft>(() => initialDraft ?? emptyDraft(board))
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!draft.title.trim() || busy) return
    setBusy(true)
    try {
      await onCreate({ ...draft, title: draft.title.trim() })
    } finally {
      setBusy(false)
    }
  }

  usePanelEscape(onClose, creating ? { onSubmit: () => void create() } : {})

  const column = board.columns.find((c) => c.id === (card ? statusOf(board, card) : draft.status))

  return (
    <aside className="panel card-panel" aria-label={creating ? 'New card' : `Card: ${card.title}`}>
      <div className="panel-h">
        <span className="mono muted trunc">
          {board.name} / {creating ? 'New card' : column?.name}
        </span>
        <span className="grow" />
        {card && (
          <>
            <Link
              to={fileUrl(ws, `${board.path}/${card.file}`)}
              className="ibtn ibtn-s"
              aria-label="Open as full page"
              title="Open as full page"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M5 11l6-6M6 5h5v5" />
              </svg>
            </Link>
            <IconButton small label="Previous card" onClick={() => onStep?.(-1)}>
              <IconChevUp size={14} />
            </IconButton>
            <IconButton small label="Next card" onClick={() => onStep?.(1)}>
              <IconChevDown size={14} />
            </IconButton>
          </>
        )}
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>

      <div className="panel-body">
        {top}
        <CardDocument
          ws={ws}
          board={board}
          cards={cards}
          people={people}
          card={card}
          draft={draft}
          setDraft={setDraft}
          onPatch={onPatch}
          onRun={onRun}
          onSubmitDraft={() => void create()}
          layout="panel"
        />
        {error && <span className="help err">{error}</span>}
      </div>

      <div className="row between panel-f">
        {card ? (
          <>
            <span className="mono-s muted">Saved to {card.file}</span>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete card
            </Button>
          </>
        ) : (
          <>
            <span className="mono-s muted">
              <span className="kbd">⌘↵</span> create · <span className="kbd">Esc</span> cancel
            </span>
            <span className="row g8">
              <Button size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                busy={busy}
                disabled={!draft.title.trim()}
                onClick={() => void create()}
              >
                {createLabel}
              </Button>
            </span>
          </>
        )}
      </div>
    </aside>
  )
}
