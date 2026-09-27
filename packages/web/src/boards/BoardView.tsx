import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type DragEvent, useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, type Board, type Card, type CardPatch, type Column, type Person } from '../api'
import { Button, ButtonLink, IconButton, TextButton } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { TextArea, TextInput, TitleInput } from '../components/Field'
import { Popover } from '../components/Popover'
import { IconCross, IconPlus } from '../icons'
import { fileUrl, useShell, wsUrl } from '../shell/context'
import { usePaneId } from '../shell/paneId'
import { PersonAvatar } from '../ui'
import { CardPanel, type Draft } from './CardPanel'
import { KanbanCard } from './KanbanCard'
import { applyLocal, boardUrl, doneColumn, slug, statusOf, usePeople } from './shared'

interface DropTarget {
  column: string
  index: number
}

const DONE_PREVIEW = 5

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
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.board(ws, boardId), refetchInterval: 15_000 })
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
    } catch (e) {
      setErr((e as Error).message)
      toast((e as Error).message, 'bad')
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
        <p className="lede danger-t">{(error as Error).message}</p>
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
  const assignees = [...new Set(['me', ...(cards.map((c) => c.assignee).filter(Boolean) as string[])])]

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
      const next = [...lane]
      next.splice(target.index, 0, { file } as Card)
      next.forEach((c, i) => {
        if (c.file === file) void patchCard(file, { status: column, order: i })
        else if (c.order !== i) void patchCard(c.file, { order: i })
      })
      return
    }
    const prev = lane[target.index - 1]?.order
    const next = lane[target.index]?.order
    const order =
      prev === undefined && next === undefined
        ? 0
        : prev === undefined
          ? (next as number) - 1
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
    } catch (e) {
      setErr((e as Error).message)
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
      navigate(boardUrl(ws, b.path), { replace: true })
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
                      if (e.key === 'Enter') rename((e.target as HTMLInputElement).value.trim())
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
                      navigate(wsUrl(ws, 'boards'))
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
                    cols.splice(ci + dir, 0, c)
                    void saveColumns(cols)
                  }}
                  onDelete={async () => {
                    if (board.columns.length < 2) return
                    const ok =
                      lane.length === 0 ||
                      (await confirm({
                        title: `Delete column “${col.name}”?`,
                        body: `Its ${laneAll.length} cards move to “${board.columns[ci === 0 ? 1 : 0].name}”. No files are deleted.`,
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
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null)
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
            status: board.columns.some((c) => c.id === newIn) ? newIn : board.columns[0].id,
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

function AssigneeFilter({
  who,
  ids,
  people,
  onChange,
}: {
  who: string
  ids: string[]
  people: Person[]
  onChange: (v: string) => void
}) {
  return (
    <div className="row g6" role="group" aria-label="Filter by assignee">
      <button type="button" className={`pill${who ? '' : ' on'}`} style={{ height: 30 }} onClick={() => onChange('')}>
        All
      </button>
      {ids.map((id) => {
        const name = people.find((p) => p.id === id)?.name ?? id
        return (
          <button
            key={id}
            type="button"
            className={`av-filter${who === id ? ' on' : ''}`}
            aria-pressed={who === id}
            aria-label={`Only @${id} (${name})`}
            title={`Only @${id}`}
            onClick={() => onChange(who === id ? '' : id)}
          >
            <PersonAvatar id={id} people={people} size="l" />
          </button>
        )
      })}
    </div>
  )
}

function KColumn({
  column,
  index,
  board,
  count,
  isDrop,
  collapse,
  total,
  onRename,
  onMove,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
  onQuickAdd,
  onMore,
  renderCards,
}: {
  column: Column
  index: number
  board: Board
  count: number
  isDrop: boolean
  collapse: boolean
  total: number
  onRename: (name: string) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: (e: DragEvent<HTMLElement>) => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onQuickAdd: (title: string) => Promise<unknown>
  onMore: (title: string) => void
  renderCards: (limit: number) => React.ReactNode
}) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [composing, setComposing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenu(false), [])
  const limit = collapse && !expanded ? DONE_PREVIEW : Number.POSITIVE_INFINITY

  const commitRename = (v: string) => {
    setRenaming(false)
    if (v.trim() && v.trim() !== column.name) onRename(v.trim())
  }

  return (
    <section
      className={`kcol${isDrop ? ' is-drop' : ''}`}
      aria-label={column.name}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="kcol-h">
        {renaming ? (
          <TextInput
            compact
            autoFocus
            defaultValue={column.name}
            aria-label="Column name"
            style={{ height: 28 }}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <span className="n" onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
            <b>{count}</b>
            {column.name}
          </span>
        )}
        <IconButton ref={menuBtn} small label="Column options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="3.5" cy="8" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="12.5" cy="8" r="1.2" />
          </svg>
        </IconButton>
        <Popover anchor={menuBtn} open={menu} onClose={closeMenu} align="end" role="menu">
          {[
            ['Rename', () => setRenaming(true), false],
            ['Add card', () => setComposing(true), false],
            ['Move left', () => onMove(-1), index === 0],
            ['Move right', () => onMove(1), index === board.columns.length - 1],
          ].map(([label, fn, disabled]) => (
            <button
              key={label as string}
              type="button"
              role="menuitem"
              className="mi"
              disabled={disabled as boolean}
              onClick={() => {
                closeMenu()
                ;(fn as () => void)()
              }}
            >
              {label as string}
            </button>
          ))}
          <span className="sepline" />
          <button
            type="button"
            role="menuitem"
            className="mi danger-t"
            disabled={board.columns.length < 2}
            onClick={() => {
              closeMenu()
              onDelete()
            }}
          >
            Delete column
          </button>
        </Popover>
      </div>
      {renderCards(limit)}
      {collapse && (
        <button type="button" className="kadd" onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Show less' : `Show ${total - DONE_PREVIEW} more`}
        </button>
      )}
      {composing ? (
        <Composer onAdd={onQuickAdd} onMore={onMore} onClose={() => setComposing(false)} />
      ) : (
        <button type="button" className="kadd" onClick={() => setComposing(true)}>
          <IconPlus size={12} sw={1.6} />
          Add card
        </button>
      )}
    </section>
  )
}

/** Inline quick-add: Enter adds and stays open for the next; "More fields" opens the full card panel. */
function Composer({
  onAdd,
  onMore,
  onClose,
}: {
  onAdd: (title: string) => Promise<unknown>
  onMore: (title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async () => {
    const t = title.trim()
    if (!t || busy) return
    setBusy(true)
    await onAdd(t)
    setBusy(false)
    setTitle('')
  }
  return (
    <div className="kcard composer">
      <TextArea
        autoFocus
        autoGrow={140}
        rows={2}
        className="composer-in"
        placeholder="Card title…"
        aria-label="New card title"
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            onMore(title.trim())
          } else if (e.key === 'Enter') {
            e.preventDefault()
            void add()
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        onBlur={(e) => {
          if (!title.trim() && !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) onClose()
        }}
      />
      <div className="row between">
        <span className="row g10">
          <Button variant="primary" size="sm" busy={busy} disabled={!title.trim()} onClick={() => void add()}>
            Add
          </Button>
          <TextButton onClick={() => onMore(title.trim())} title="Assignee, due date, labels, AI task… (⇧↵)">
            [⤢] More fields
          </TextButton>
        </span>
        <IconButton small label="Cancel (Esc)" onClick={onClose}>
          <IconCross size={12} sw={1.6} />
        </IconButton>
      </div>
    </div>
  )
}

function AddColumn({
  open,
  setOpen,
  onAdd,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState('')
  if (!open)
    return (
      <button type="button" className="kcol kcol-add" onClick={() => setOpen(true)}>
        <span className="mono">[+] Add column</span>
      </button>
    )
  const commit = () => {
    if (name.trim()) onAdd(name.trim())
    setName('')
    setOpen(false)
  }
  return (
    <div className="kcol" style={{ gap: 10 }}>
      <TextInput
        compact
        autoFocus
        placeholder="Column name"
        aria-label="New column name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <div className="row g8">
        <Button variant="primary" size="sm" disabled={!name.trim()} onClick={commit}>
          Add column
        </Button>
        <Button size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
