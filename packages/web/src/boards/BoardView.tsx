import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type DragEvent, useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { useConfirm, useToast } from '../components/Dialog'
import { TitleInput } from '../components/TitleInput'
import { applyLocal, doneColumn, firstColumn, slug, statusOf } from '../helpers/boards'
import { errorMessage } from '../helpers/format'
import { boardUrl, fileUrl, wsUrl } from '../helpers/urls'
import { usePeople } from '../hooks/usePeople'
import { usePaneId } from '../shell/paneId'
import { useShell } from '../shell/ShellContext'
import type { Board, Card, CardPatch, Column, Draft, DropTarget } from '../types/boards'
import { AddColumn } from './AddColumn'
import { AssigneeFilter } from './AssigneeFilter'
import { CardPanel } from './CardPanel'
import { DONE_PREVIEW } from './helpers'
import { KanbanCard } from './KanbanCard'
import { KColumn } from './KColumn'

export function BoardView() {
  const { ws = '', '*': boardId = '' } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const shell = useShell()
  const paneId = usePaneId()
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const people = usePeople()
  const key = ['board', ws, boardId]
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.board(ws, boardId) })
  const [dragging, setDragging] = useState<string | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [err, setErr] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const who = search.get('who') ?? ''
  const openId = search.get('card')
  const newIn = search.get('new')
  const setParams = useCallback(
    (p: Record<string, string | null>) =>
      setSearch(
        (s) => {
          for (const [k, v] of Object.entries(p)) {
            if (v) s.set(k, v)
            else s.delete(k)
          }
          return s
        },
        { replace: true },
      ),
    [setSearch],
  )

  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr('')
      await fn()
    } catch (caught) {
      const msg = errorMessage(caught)
      setErr(msg)
      toast(msg, 'bad')
    } finally {
      void refresh()
    }
  }

  const patchCard = (file: string, patch: CardPatch) =>
    run(async () => {
      qc.setQueryData<{ board: Board; cards: Card[] }>(
        key,
        (d) => d && { ...d, cards: d.cards.map((c) => (c.file === file ? applyLocal(c, patch) : c)) },
      )
      const saved = await api.updateCard(ws, boardId, file, patch)
      // A new title renames the file; keep the open card pointing at it.
      if (saved.file !== file && search.get('card') === file) setParams({ card: saved.file })
    })

  const saveColumns = (columns: Column[]) => run(() => api.updateBoard(ws, boardId, { columns }))

  if (error)
    return (
      <div className="page col g12">
        <span className="mono muted">{ws} / boards</span>
        <p className="lede danger-t">{error.message}</p>
        <Link to={wsUrl(ws, 'boards')} className="link">
          [← All boards]
        </Link>
      </div>
    )
  if (!data)
    return (
      <div className="page col g20">
        <div className="skel" style={{ height: 44, width: 280 }} />
        <div className="board">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kcol">
              <div className="skel" style={{ height: 90 }} />
            </div>
          ))}
        </div>
      </div>
    )

  const { board, cards } = data
  // Cards open in another split side show as selected here.
  const shownBeside = (file: string) => {
    const url = fileUrl(ws, `${board.path}/${file}`)
    return shell.sides.some((side) => side.id !== paneId && side.path.split('?')[0] === url)
  }
  const last = doneColumn(board)
  const visible = cards.filter((c) => !who || (who === '-' ? !c.assignee : c.assignee === who))
  const ordered = board.columns.flatMap((col) => visible.filter((c) => statusOf(board, c) === col.id))
  const open = cards.find((c) => c.file === openId)
  const inReview = cards.filter((c) => c.status === 'review' && c.ai?.state === 'done').length
  const assignees = [...new Set(['me', ...cards.map((c) => c.assignee).filter((a): a is string => Boolean(a))])]

  const onDrop = (e: DragEvent, column: string) => {
    e.preventDefault()
    const file = e.dataTransfer.getData('text/plain') || dragging
    const target = drop
    setDragging(null)
    setDrop(null)
    if (!file || !target) return
    const lane = cards.filter((c) => statusOf(board, c) === column && c.file !== file)
    if (lane.some((c) => c.order === undefined)) {
      // Hand-made cards have no order yet: number the whole lane once.
      void patchCard(file, { status: column, order: target.index })
      lane.forEach((c, i) => {
        const order = i < target.index ? i : i + 1
        if (c.order !== order) void patchCard(c.file, { order })
      })
      return
    }
    const prev = lane[target.index - 1]?.order
    const next = lane[target.index]?.order
    const order =
      prev === undefined && next === undefined
        ? 0
        : prev === undefined
          ? (next ?? 0) - 1
          : next === undefined
            ? prev + 1
            : (prev + next) / 2
    void patchCard(file, { status: column, order })
  }

  const createCard = async (d: Draft) => {
    try {
      setErr('')
      const c = await api.createCard(ws, boardId, {
        title: d.title,
        status: d.status,
        assignee: d.assignee || undefined,
        due: d.due || undefined,
        duration: d.duration,
        labels: d.labels,
        description: d.description || undefined,
        runAt: d.assignee === 'ai' ? d.runAt || undefined : undefined,
        context: d.assignee === 'ai' ? d.context : undefined,
      })
      await refresh()
      setParams({ new: null, card: c.file })
      toast(`Created “${c.title}”`)
    } catch (caught) {
      setErr(errorMessage(caught))
    }
  }

  const quickCreate = (title: string, column: string) =>
    run(() => api.createCard(ws, boardId, { title, status: column, ...(who && who !== '-' ? { assignee: who } : {}) }))

  const rename = (name: string) => {
    setRenaming(false)
    if (!name || name === board.name) return
    void run(async () => {
      const b = await api.updateBoard(ws, boardId, { name })
      await qc.invalidateQueries({ queryKey: ['boards', ws] })
      void navigate(boardUrl(ws, b.path), { replace: true })
    })
  }

  const step = (dir: -1 | 1) => {
    const i = ordered.findIndex((c) => c.file === openId)
    const next = ordered[(i + dir + ordered.length) % ordered.length]
    if (next) setParams({ card: next.file })
  }

  const panelOpen = !!open || !!newIn

  return (
    <div className={`board-view${panelOpen ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g20" style={{ padding: '26px 32px 32px' }}>
          <div className="col g12">
            <div className="row between">
              <nav className="mono muted row g8" aria-label="Breadcrumb">
                <Link to={wsUrl(ws, 'boards')} className="link muted">
                  Boards
                </Link>
                <span>/</span>
                <span style={{ color: 'var(--ink)' }}>{board.name}</span>
              </nav>
              <span className="mono-s muted">
                {ws}/{board.path}/
              </span>
            </div>
            <div className="row between g16 wrap">
              <div className="row g16" style={{ alignItems: 'baseline', minWidth: 0 }}>
                {renaming ? (
                  <TitleInput
                    autoFocus
                    className="display"
                    style={{ fontSize: 44, width: 420 }}
                    defaultValue={board.name}
                    aria-label="Board name"
                    onBlur={(e) => rename(e.target.value.trim())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(e.currentTarget.value.trim())
                      if (e.key === 'Escape') setRenaming(false)
                    }}
                  />
                ) : (
                  <h1
                    className="display editable"
                    style={{ fontSize: 44 }}
                    title="Double-click to rename"
                    onDoubleClick={() => setRenaming(true)}
                  >
                    {board.name}
                  </h1>
                )}
                <span className="mono muted">
                  {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                  {inReview > 0 && ` · ${inReview} by AI in review`}
                </span>
              </div>
              <div className="row g8 wrap">
                <AssigneeFilter
                  who={who}
                  ids={assignees}
                  people={people}
                  onChange={(v) => setParams({ who: v || null })}
                />
                <span style={{ width: 1, height: 24, borderLeft: '1px dashed var(--line)', margin: '0 4px' }} />
                <Button onClick={() => setAddingColumn(true)}>[+] Column</Button>
                <ButtonLink to={fileUrl(ws, `${board.path}/.board.json`)} title="Edit the board’s config file">
                  {'{ }'} .board.json
                </ButtonLink>
                <Button
                  variant="danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Remove board?',
                      body: (
                        <>
                          <b>{board.name}</b> stops being a board. The folder and its {cards.length} card files stay in{' '}
                          <span className="mono-s">{board.path}/</span>.
                        </>
                      ),
                      confirmLabel: 'Remove board',
                      destructive: true,
                      typeToConfirm: board.name,
                    })
                    if (!ok) return
                    void run(async () => {
                      await api.deleteBoard(ws, boardId)
                      await qc.invalidateQueries({ queryKey: ['boards', ws] })
                      void navigate(wsUrl(ws, 'boards'))
                    })
                  }}
                >
                  Remove board
                </Button>
              </div>
            </div>
          </div>

          <div className="board">
            {board.columns.map((col, ci) => {
              const lane = visible.filter((c) => statusOf(board, c) === col.id)
              const laneAll = cards.filter((c) => statusOf(board, c) === col.id && c.file !== dragging)
              const indicator = drop?.column === col.id ? drop.index : -1
              return (
                <KColumn
                  key={col.id}
                  board={board}
                  column={col}
                  index={ci}
                  count={lane.length}
                  isDrop={drop?.column === col.id}
                  collapse={col.id === last && lane.length > DONE_PREVIEW + 1}
                  onRename={(name) => saveColumns(board.columns.map((c) => (c.id === col.id ? { ...c, name } : c)))}
                  onMove={(dir) => {
                    const cols = [...board.columns]
                    const [c] = cols.splice(ci, 1)
                    if (c) cols.splice(ci + dir, 0, c)
                    void saveColumns(cols)
                  }}
                  onDelete={async () => {
                    if (board.columns.length < 2) return
                    const ok =
                      lane.length === 0 ||
                      (await confirm({
                        title: `Delete column “${col.name}”?`,
                        body: `Its ${laneAll.length} cards move to “${board.columns[ci === 0 ? 1 : 0]?.name}”. No files are deleted.`,
                        confirmLabel: 'Delete column',
                        destructive: true,
                      }))
                    if (ok) void saveColumns(board.columns.filter((c) => c.id !== col.id))
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    // Entering the lane targets its end; hovering a card refines the position.
                    if (drop?.column !== col.id) setDrop({ column: col.id, index: laneAll.length })
                  }}
                  onDragLeave={(e) => {
                    if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDrop(null)
                  }}
                  onDrop={(e) => onDrop(e, col.id)}
                  onQuickAdd={(title) => quickCreate(title, col.id)}
                  onMore={(title) => {
                    setNewTitle(title)
                    setParams({ card: null, new: col.id })
                  }}
                  renderCards={(limit) => (
                    <>
                      {lane.slice(0, limit).map((card) => {
                        const index = laneAll.findIndex((c) => c.file === card.file)
                        return (
                          <div key={card.file} className="col" style={{ gap: 6 }}>
                            {indicator === index && <div className="dropline" aria-hidden="true" />}
                            <KanbanCard
                              ws={ws}
                              card={card}
                              people={people}
                              done={col.id === last}
                              selected={card.file === openId || shownBeside(card.file)}
                              dragging={dragging === card.file}
                              onOpen={() => {
                                // Split view: the card opens as a page in the other side, the board keeps its space.
                                if (shell.openInOther(paneId, fileUrl(ws, `${board.path}/${card.file}`))) {
                                  setParams({ new: null, card: null })
                                  return
                                }
                                setParams({ new: null, card: card.file === openId ? null : card.file })
                              }}
                              onAccept={() => void patchCard(card.file, { status: last })}
                              onRetry={() => void run(() => api.runCard(ws, boardId, card.file))}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', card.file)
                                e.dataTransfer.effectAllowed = 'move'
                                setDragging(card.file)
                              }}
                              onDragEnd={() => {
                                setDragging(null)
                                setDrop(null)
                              }}
                              onDragOver={(e) => {
                                if (index < 0) return
                                e.preventDefault()
                                e.stopPropagation()
                                const r = e.currentTarget.getBoundingClientRect()
                                const i = e.clientY < r.top + r.height / 2 ? index : index + 1
                                if (drop?.column !== col.id || drop.index !== i) setDrop({ column: col.id, index: i })
                              }}
                            />
                          </div>
                        )
                      })}
                      {indicator === laneAll.length && dragging && <div className="dropline" aria-hidden="true" />}
                    </>
                  )}
                  total={lane.length}
                />
              )
            })}
            <AddColumn
              open={addingColumn}
              setOpen={setAddingColumn}
              onAdd={(name) => {
                let id = slug(name)
                for (let i = 2; board.columns.some((c) => c.id === id); i++) id = `${slug(name)}-${i}`
                void saveColumns([...board.columns, { id, name }])
              }}
            />
          </div>
          {err && !panelOpen && <span className="help err">{err}</span>}
        </div>
      </div>

      {open && (
        <CardPanel
          key={open.file}
          ws={ws}
          board={board}
          cards={cards}
          people={people}
          card={open}
          onPatch={(patch) => patchCard(open.file, patch)}
          onCreate={createCard}
          onRun={() => run(() => api.runCard(ws, boardId, open.file))}
          onStep={step}
          onDelete={async () => {
            const ok = await confirm({
              title: 'Delete card?',
              body: (
                <>
                  <b>{open.title}</b> and its file <span className="mono-s">{open.file}</span> are deleted.
                </>
              ),
              confirmLabel: 'Delete card',
              destructive: true,
            })
            if (!ok) return
            void run(async () => {
              setParams({ card: null })
              await api.deleteCard(ws, boardId, open.file)
              toast(`Deleted “${open.title}”`, 'quiet')
            })
          }}
          onClose={() => setParams({ card: null })}
          error={err}
        />
      )}
      {!open && newIn && (
        <CardPanel
          key={`new:${newIn}:${newTitle}`}
          ws={ws}
          board={board}
          cards={cards}
          people={people}
          draft={{
            title: newTitle,
            status: board.columns.some((c) => c.id === newIn) ? newIn : firstColumn(board),
            assignee: who && who !== '-' ? who : undefined,
            labels: [],
            description: '',
            context: [],
          }}
          onPatch={async () => {}}
          onCreate={createCard}
          onRun={async () => {}}
          onDelete={() => {}}
          onClose={() => {
            setNewTitle('')
            setParams({ new: null })
          }}
          error={err}
        />
      )}
    </div>
  )
}
