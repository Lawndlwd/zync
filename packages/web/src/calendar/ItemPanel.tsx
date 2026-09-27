import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api, type Board, type CardPatch, type FileData, type Person, type Repeat } from '../api'
import { CardPanel, type Draft } from '../boards/CardPanel'
import { Button, IconButton } from '../components/Button'
import { Segmented } from '../components/Controls'
import { DatePicker, formatDateValue } from '../components/DatePicker'
import { useConfirm, useToast } from '../components/Dialog'
import { TitleInput } from '../components/Field'
import { Select } from '../components/Select'
import { TagInput } from '../components/TagInput'
import { MarkdownFile } from '../FileView'
import { IconCross } from '../icons'
import { fileUrl } from '../shell/context'
import { addMinutes, DEFAULT_MINUTES, dayOf, daysBetween, minutesBetween, shiftDays } from './model'
import { describeRepeat, RepeatField } from './RepeatField'

const CALENDAR_DIR = 'Calendar'

export type Selection =
  /** `date`: the occurrence clicked, for a recurring event. */
  | { type: 'event'; file: string; date?: string }
  | { type: 'card'; board: string; file: string }
  | { type: 'new'; start: string; end: string }

interface PanelProps {
  ws: string
  people: Person[]
  onSelect: (s: Selection) => void
  /** Something was written: refresh the calendar. */
  onChanged: () => void
  onClose: () => void
}

/** The calendar's side panel: an event's page, a card's page, or a new event / card. */
export function ItemPanel({ selection, ...rest }: PanelProps & { selection: Selection }) {
  if (selection.type === 'event') return <EventPanel {...rest} file={selection.file} date={selection.date} />
  if (selection.type === 'card') return <CardSide {...rest} board={selection.board} file={selection.file} />
  return <NewPanel {...rest} start={selection.start} end={selection.end} />
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.floating')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

function Shell({
  label,
  crumb,
  open,
  onClose,
  footer,
  children,
}: {
  label: string
  crumb: ReactNode
  open?: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <aside className="panel card-panel" aria-label={label}>
      <div className="panel-h">
        <span className="mono muted trunc">{crumb}</span>
        <span className="grow" />
        {open && (
          <Link to={open} className="ibtn ibtn-s" aria-label="Open as full page" title="Open as full page">
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
        )}
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">{children}</div>
      <div className="row between panel-f">{footer}</div>
    </aside>
  )
}

// ── an event: its page, edited like any file ────────────────────────────────

function EventPanel({ ws, file, date, onSelect, onChanged, onClose }: PanelProps & { file: string; date?: string }) {
  const path = `${CALENDAR_DIR}/${file}`
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const { data, error } = useQuery({ queryKey: ['file', ws, path], queryFn: () => api.file(ws, path) })
  // Same rules as the file view: reload when the file changes underneath (a calendar drag, the AI)
  // unless there are unsaved local edits; never because of our own save.
  const [loaded, setLoaded] = useState<FileData | null>(null)
  const pending = useRef<string | null>(null)
  const ownMtime = useRef<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEscape(onClose)

  useEffect(() => {
    if (!data) return
    if (!loaded || (data.mtime !== loaded.mtime && data.mtime !== ownMtime.current && pending.current === null))
      setLoaded(data)
  }, [data])

  const flush = async () => {
    clearTimeout(timer.current)
    const content = pending.current
    if (content === null) return
    pending.current = null
    try {
      ownMtime.current = (await api.save(ws, path, content)).mtime
      onChanged()
    } catch (e) {
      pending.current ??= content
      toast((e as Error).message, 'bad')
    }
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => void flushRef.current(), [])

  // The parsed event (for its repeat rule), refetched whenever the file changes.
  const { data: event } = useQuery({
    queryKey: ['event', ws, file, data?.mtime],
    queryFn: () => api.event(ws, file),
    enabled: !!data,
  })
  const setRepeat = async (repeat: Repeat | null) => {
    await flush()
    try {
      await api.updateEvent(ws, file, { repeat })
      await qc.invalidateQueries({ queryKey: ['file', ws, path] })
      onChanged()
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  const title = file.replace(/\.md$/, '')
  const rename = async (next: string) => {
    if (!next || next === title) return
    await flush()
    try {
      const e = await api.updateEvent(ws, file, { title: next })
      onChanged()
      onSelect({ type: 'event', file: e.file })
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <Shell
      label={`Event: ${title}`}
      crumb={`${CALENDAR_DIR} / event`}
      open={fileUrl(ws, path)}
      onClose={onClose}
      footer={
        <>
          <span className="mono-s muted trunc">Saved to {path}</span>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete event?',
                body: (
                  <>
                    <b>{title}</b> and its page <span className="mono-s">{path}</span> are deleted.
                  </>
                ),
                confirmLabel: 'Delete event',
                destructive: true,
              })
              if (!ok) return
              try {
                pending.current = null
                await api.deleteEvent(ws, file)
                qc.removeQueries({ queryKey: ['file', ws, path] })
                onChanged()
                onClose()
                toast(`Deleted “${title}”`, 'quiet')
              } catch (e) {
                toast((e as Error).message, 'bad')
              }
            }}
          >
            Delete event
          </Button>
        </>
      }
    >
      <div className="doc card-doc in-panel col g20">
        <div className="col g6">
          <TitleInput
            key={file}
            className="doc-title"
            defaultValue={title}
            aria-label="Title (file name)"
            onBlur={(e) => void rename(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <span className="mono-s muted">{path}</span>
        </div>
        {event && (
          <section className="props" aria-label="Repeat">
            <div className="kv props-grid">
              <RepeatField value={event.repeat} start={event.start} onChange={(r) => void setRepeat(r)} />
            </div>
            {event.repeat && (
              <div className="row between g8 wrap repeat-sum">
                <span className="small muted">{describeRepeat(event.repeat, event.start)}</span>
                {date && !event.repeat.except?.includes(date) && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void setRepeat({ ...event.repeat!, except: [...(event.repeat!.except ?? []), date] }).then(() => {
                        toast(`Skipped ${formatDateValue(date, false)}`, 'quiet')
                        onClose()
                      })
                    }
                  >
                    Skip {formatDateValue(date, false)}
                  </Button>
                )}
              </div>
            )}
          </section>
        )}
        {error ? (
          <p className="small danger-t">{(error as Error).message}</p>
        ) : !loaded ? (
          <div className="skel" style={{ height: 160 }} />
        ) : (
          <MarkdownFile
            key={loaded.mtime}
            ws={ws}
            dir={CALENDAR_DIR}
            content={loaded.content ?? ''}
            onChange={(content) => {
              pending.current = content
              clearTimeout(timer.current)
              timer.current = window.setTimeout(() => void flush(), 700)
            }}
          />
        )}
      </div>
    </Shell>
  )
}

// ── a card: the board's own panel ───────────────────────────────────────────

function CardSide({
  ws,
  board: boardPath,
  file,
  people,
  onSelect,
  onChanged,
  onClose,
}: PanelProps & { board: string; file: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const key = ['board', ws, boardPath]
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.board(ws, boardPath) })
  const [err, setErr] = useState('')
  const card = data?.cards.find((c) => c.file === file)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr('')
      await fn()
    } catch (e) {
      setErr((e as Error).message)
      toast((e as Error).message, 'bad')
    } finally {
      await qc.invalidateQueries({ queryKey: key })
      onChanged()
    }
  }

  if (error || (data && !card))
    return (
      <Shell label="Card" crumb={boardPath} onClose={onClose} footer={null}>
        <p className="small muted">{error ? (error as Error).message : 'This card no longer exists.'}</p>
      </Shell>
    )
  if (!data || !card)
    return (
      <Shell label="Card" crumb={boardPath} onClose={onClose} footer={null}>
        <div className="skel" style={{ height: 200 }} />
      </Shell>
    )

  return (
    <CardPanel
      ws={ws}
      board={data.board}
      cards={data.cards}
      people={people}
      card={card}
      onPatch={(patch: CardPatch) =>
        run(async () => {
          const saved = await api.updateCard(ws, boardPath, file, patch)
          if (saved.file !== file) onSelect({ type: 'card', board: boardPath, file: saved.file })
        })
      }
      onCreate={async () => {}}
      onRun={() => run(() => api.runCard(ws, boardPath, file))}
      onDelete={async () => {
        const ok = await confirm({
          title: 'Delete card?',
          body: (
            <>
              <b>{card.title}</b> and its file <span className="mono-s">{card.file}</span> are deleted.
            </>
          ),
          confirmLabel: 'Delete card',
          destructive: true,
        })
        if (!ok) return
        await run(async () => {
          await api.deleteCard(ws, boardPath, file)
          onClose()
          toast(`Deleted “${card.title}”`, 'quiet')
        })
      }}
      onClose={onClose}
      error={err}
    />
  )
}

// ── something new: an event (a page in Calendar/) or a card on a board ──────

type NewKind = 'event' | 'card'

function NewPanel({
  ws,
  start,
  end,
  people,
  onSelect,
  onChanged,
  onClose,
}: PanelProps & { start: string; end: string }) {
  const toast = useToast()
  const [kind, setKind] = useState<NewKind>('event')
  const { data: boards = [] } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  const [boardPath, setBoardPath] = useState<string>('')
  const board: Board | undefined = boards.find((b) => b.path === boardPath) ?? boards[0]

  const switcher = (
    <div className="row between g8 cal-new-switch">
      <Segmented<NewKind>
        label="Create"
        value={kind}
        options={[
          { value: 'event', label: 'Event' },
          { value: 'card', label: 'Card' },
        ]}
        onChange={setKind}
      />
      {kind === 'card' && boards.length > 0 && (
        <div style={{ minWidth: 160 }}>
          <Select
            compact
            ariaLabel="Board"
            value={board?.path}
            options={boards.map((b) => ({ value: b.path, label: b.name, text: b.path }))}
            onChange={setBoardPath}
          />
        </div>
      )}
    </div>
  )

  if (kind === 'card' && board) {
    const timed = start.length > 10
    const minutes = timed ? minutesBetween(start, end) : DEFAULT_MINUTES
    const draft: Draft = {
      title: '',
      status: board.columns[0].id,
      due: timed ? start : dayOf(start),
      duration: timed && minutes !== DEFAULT_MINUTES ? minutes : undefined,
      labels: [],
      description: '',
      context: [],
    }
    return (
      <CardPanel
        key={board.path}
        ws={ws}
        board={board}
        cards={[]}
        people={people}
        draft={draft}
        top={switcher}
        onPatch={async () => {}}
        onCreate={async (d) => {
          try {
            const c = await api.createCard(ws, board.path, {
              title: d.title,
              status: d.status,
              assignee: d.assignee || undefined,
              due: d.due || undefined,
              duration: d.due?.includes('T') ? d.duration : undefined,
              labels: d.labels,
              description: d.description || undefined,
              runAt: d.assignee === 'ai' ? d.runAt || undefined : undefined,
              context: d.assignee === 'ai' ? d.context : undefined,
            })
            onChanged()
            onSelect({ type: 'card', board: board.path, file: c.file })
            toast(`Created “${c.title}”`)
          } catch (e) {
            toast((e as Error).message, 'bad')
          }
        }}
        onRun={async () => {}}
        onDelete={() => {}}
        onClose={onClose}
        error=""
        createLabel="Create card"
      />
    )
  }

  return (
    <NewEvent
      ws={ws}
      start={start}
      end={end}
      people={people}
      top={switcher}
      noBoards={kind === 'card' && !boards.length}
      onCreated={(file) => {
        onChanged()
        onSelect({ type: 'event', file })
      }}
      onClose={onClose}
    />
  )
}

function NewEvent({
  ws,
  start: initialStart,
  end: initialEnd,
  people,
  top,
  noBoards,
  onCreated,
  onClose,
}: {
  ws: string
  start: string
  end: string
  people: Person[]
  top: ReactNode
  noBoards: boolean
  onCreated: (file: string) => void
  onClose: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState<string | undefined>(initialEnd)
  const [who, setWho] = useState<string[]>(['me'])
  const [repeat, setRepeat] = useState<Repeat | null>(null)
  const [busy, setBusy] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  useEscape(onClose)
  useEffect(() => titleRef.current?.focus(), [])

  // Keep start and end the same kind (both days, or both times).
  const mixed = !!end && start.length !== end.length
  const create = async () => {
    if (!title.trim() || busy || mixed) return
    setBusy(true)
    try {
      const e = await api.createEvent(ws, {
        title: title.trim(),
        start,
        end: end && end !== start ? end : undefined,
        people: who,
        repeat: repeat ?? undefined,
      })
      toast(`Added “${e.title}”`)
      onCreated(e.file)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell
      label="New event"
      crumb={`${CALENDAR_DIR} / new event`}
      onClose={onClose}
      footer={
        <>
          <span className="mono-s muted">
            <span className="kbd">↵</span> create · <span className="kbd">Esc</span> cancel
          </span>
          <span className="row g8">
            <Button size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              busy={busy}
              disabled={!title.trim() || mixed}
              onClick={() => void create()}
            >
              Create event
            </Button>
          </span>
        </>
      }
    >
      <div className="col g16">
        {top}
        {noBoards ? (
          <p className="small muted">There are no boards yet: create one on the Boards page to add cards from here.</p>
        ) : null}
        <div className="doc card-doc in-panel col g20">
          <div className="col g6">
            <TitleInput
              ref={titleRef}
              className="doc-title"
              placeholder="New event"
              value={title}
              aria-label="Title (file name)"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void create()
                }
              }}
            />
            <span className="mono-s muted">
              {CALENDAR_DIR}/{title.trim() || 'Untitled'}.md
            </span>
          </div>
          <section className="props" aria-label="Properties">
            <div className="kv props-grid">
              <span className="k">start</span>
              <DatePicker
                compact
                optionalTime
                ariaLabel="start"
                value={start}
                onChange={(v) => {
                  if (!v) return
                  // Moving the start keeps the length.
                  if (end && end.length === v.length && start.length === v.length)
                    setEnd(
                      v.length > 10 ? addMinutes(end, minutesBetween(start, v)) : shiftDays(end, daysBetween(start, v)),
                    )
                  else setEnd(undefined)
                  setStart(v)
                }}
              />
              <span className="k">end</span>
              <DatePicker
                compact
                optionalTime
                ariaLabel="end"
                placeholder={start.length > 10 ? '1 hour' : 'Same day'}
                value={end}
                invalid={mixed || (!!end && end < start)}
                onChange={(v) => setEnd(v ?? undefined)}
              />
              <span className="k" style={{ alignSelf: 'start', paddingTop: 3 }}>
                people
              </span>
              <TagInput ariaLabel="people" values={who} suggestions={people.map((p) => p.id)} onChange={setWho} />
              <RepeatField value={repeat ?? undefined} start={start} onChange={setRepeat} />
            </div>
            {repeat && (
              <div className="repeat-sum">
                <span className="small muted">{describeRepeat(repeat, start)}</span>
              </div>
            )}
          </section>
          {mixed && <span className="help err">Start and end must both be all-day, or both have a time.</span>}
          <p className="muted small" style={{ margin: 0 }}>
            The event is a page: after creating it, write notes, links and @mentions in it.
          </p>
        </div>
      </div>
    </Shell>
  )
}
