import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, type Board, type Card, type Column } from '../api'
import { Button } from '../components/Button'
import { Field, TextInput } from '../components/Field'
import { Select } from '../components/Select'
import { wsUrl } from '../shell/context'
import { Chip, PersonAvatar, StatusBadge } from '../ui'
import { ago, hhmm, sameDay } from '../workspaceData'
import { boardUrl, statusOf, usePeople } from './shared'

const PRESETS: Record<string, Column[]> = {
  standard: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'todo', name: 'To do' },
    { id: 'doing', name: 'In progress' },
    { id: 'review', name: 'Review' },
    { id: 'done', name: 'Done' },
  ],
  simple: [
    { id: 'todo', name: 'To do' },
    { id: 'doing', name: 'In progress' },
    { id: 'done', name: 'Done' },
  ],
  personal: [
    { id: 'backlog', name: 'Ideas' },
    { id: 'todo', name: 'This week' },
    { id: 'review', name: 'Waiting' },
    { id: 'done', name: 'Done' },
  ],
}
const presetLabel = (k: string) => PRESETS[k].map((c) => c.name).join(' · ')

export function BoardsList() {
  const { ws = '' } = useParams()
  const { data: boards, error } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  const recent = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) }).data?.entries ?? []
  const people = usePeople()
  const boardQs = useQueries({
    queries: (boards ?? []).map((b) => ({ queryKey: ['board', ws, b.path], queryFn: () => api.board(ws, b.path) })),
  })

  return (
    <div className="page col g24">
      <div className="col g16">
        <span className="mono muted">{ws} / boards</span>
        <h1 className="display">Boards</h1>
        <p className="lede">
          Each board is a folder. Each card is a <b>.md</b> file inside it — edit them here or in Files.
        </p>
      </div>
      {error && <p className="help err">{(error as Error).message}</p>}
      <div className="boards-grid">
        {!boards &&
          [0, 1].map((i) => (
            <div key={i} className="card" style={{ minHeight: 260 }}>
              <div className="skel" style={{ height: 18, width: 140 }} />
            </div>
          ))}
        {boards?.map((b, i) => {
          const cards = boardQs[i]?.data?.cards ?? []
          const lastEdit = recent.find((f) => f.path.startsWith(`${b.path}/`))
          return <BoardCard key={b.path} ws={ws} board={b} cards={cards} people={people} lastEdit={lastEdit?.mtime} />
        })}
        <NewBoard ws={ws} />
      </div>
    </div>
  )
}

function BoardCard({
  ws,
  board,
  cards,
  people,
  lastEdit,
}: {
  ws: string
  board: Board
  cards: Card[]
  people: ReturnType<typeof usePeople>
  lastEdit?: number
}) {
  const review = cards.filter((c) => c.status === 'review').length
  const running = cards.filter((c) => c.ai?.state === 'running').length
  const next = cards
    .filter((c) => c.ai?.state === 'scheduled' && c.runAt)
    .map((c) => new Date(c.runAt as string))
    .sort((a, b) => a.getTime() - b.getTime())[0]
  const assignees = [...new Set(cards.map((c) => c.assignee).filter(Boolean) as string[])].slice(0, 5)
  const now = new Date()

  return (
    <Link to={boardUrl(ws, board.path)} className="card board-card" style={{ gap: 16 }}>
      <div className="card-h" style={{ marginBottom: 0 }}>
        <span className="t">{board.name}</span>
        <span className="m">
          {ws}/{board.path}/
        </span>
      </div>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="col g8">
          <span className="row g8 wrap">
            {review > 0 && <Chip n={review} label="In review" />}
            {running > 0 ? (
              <StatusBadge state="running">{running} running</StatusBadge>
            ) : next ? (
              <StatusBadge state="scheduled">
                Next {sameDay(next, now) ? hhmm(next) : next.toDateString().slice(0, 10)}
              </StatusBadge>
            ) : null}
            {!review && !running && !next && <span className="mono-s muted">Nothing waiting</span>}
          </span>
          {assignees.length > 0 && (
            <span className="avstack">
              {assignees.map((id) => (
                <PersonAvatar key={id} id={id} people={people} />
              ))}
            </span>
          )}
        </div>
        <span className="num">{cards.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${board.columns.length}, minmax(0, 1fr))`, gap: 6 }}>
        {board.columns.map((col) => {
          const n = cards.filter((c) => statusOf(board, c) === col.id).length
          const hot = col.id === 'review' && n > 0
          return (
            <div key={col.id} className={`tile${hot ? ' sel' : ''}`} style={{ minHeight: 76 }}>
              <span className={`mono-s trunc${hot ? '' : ' muted'}`}>{col.name}</span>
              <span className="tn">{n}</span>
            </div>
          )
        })}
      </div>
      <div className="row between">
        <span className="mono-s muted">
          {lastEdit ? `Edited ${ago(new Date(lastEdit)).toLowerCase()}` : 'No edits yet'}
        </span>
        <span className="link">[Open ↗]</span>
      </div>
    </Link>
  )
}

function NewBoard({ ws }: { ws: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('standard')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="card plain new-board"
      style={{ gap: 14 }}
      aria-label="Create board"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          const b = await api.createBoard(ws, name.trim(), { columns: PRESETS[preset] })
          await qc.invalidateQueries({ queryKey: ['boards', ws] })
          navigate(boardUrl(ws, b.path))
        } catch (e) {
          setErr((e as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="card-h" style={{ marginBottom: 0 }}>
        <span className="t">[+] New board</span>
        <span className="m">Creates a folder</span>
      </div>
      <div className="row g12 wrap" style={{ alignItems: 'flex-end' }}>
        <Field label="Board name (folder)" className="grow" style={{ minWidth: 220 }}>
          <TextInput
            placeholder="e.g. Sprint 2"
            value={name}
            invalid={!!err}
            onChange={(e) => {
              setName(e.target.value)
              setErr('')
            }}
          />
        </Field>
        <Field label="Columns" style={{ width: 360, maxWidth: '100%' }}>
          <Select
            ariaLabel="Columns"
            value={preset}
            options={Object.keys(PRESETS).map((k) => ({ value: k, label: presetLabel(k), text: presetLabel(k) }))}
            onChange={setPreset}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" busy={busy} disabled={!name.trim()}>
          Create board
        </Button>
      </div>
      {err ? (
        <span className="help err">{err}</span>
      ) : (
        <span className="help mono-s">
          → {ws}/{name.trim() || '…'}/ · columns are stored in .board.json ·{' '}
          <Link to={wsUrl(ws, 'people')} className="link">
            [People ↗]
          </Link>
        </span>
      )}
    </form>
  )
}
