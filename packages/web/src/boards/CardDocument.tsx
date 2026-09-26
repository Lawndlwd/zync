import { useQuery } from '@tanstack/react-query'
import { lazy, type Ref, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { api, type Board, type Card, type CardPatch, type Person } from '../api'
import { Button, ButtonLink } from '../components/Button'
import { DatePicker, formatDateValue } from '../components/DatePicker'
import { TitleInput } from '../components/Field'
import { PersonSelect } from '../components/PersonSelect'
import { Select } from '../components/Select'
import { TagInput } from '../components/TagInput'
import { IconChevDown, IconChevRight, IconSpark } from '../icons'
import { StatusBadge } from '../ui'
import { sessionUrl, statusOf } from './shared'

const MarkdownEditor = lazy(() => import('../MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })))

/** A card's fields: its frontmatter plus the markdown body. `title` is the file name. */
export interface Draft {
  title: string
  status: string
  assignee?: string
  due?: string
  labels: string[]
  description: string
  runAt?: string
  context: string[]
}

export const emptyDraft = (board: Board): Draft => ({
  title: '',
  status: board.columns[0].id,
  labels: [],
  description: '',
  context: [],
})

/** Paths offered as AI context: every known file plus the folders they live in. */
function useContextSuggestions(ws: string): string[] {
  const { data } = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) })
  return useMemo(() => {
    const out = new Set<string>()
    for (const f of data?.entries ?? []) {
      const parts = f.path.split('/')
      for (let i = 1; i < parts.length; i++) out.add(`${parts.slice(0, i).join('/')}/`)
    }
    for (const f of data?.entries ?? []) out.add(f.path)
    return [...out]
  }, [data])
}

/**
 * A card is a markdown file: this renders it the way Files renders any page — the title (file name),
 * the frontmatter as a property sheet, then the body in the same editor. Used by the board's side
 * panel and by Files, so a card looks and behaves the same wherever you open it. Existing cards save
 * through the card API (which also keeps the linked AI job in step); drafts stay local until created.
 */
export function CardDocument({
  ws,
  board,
  cards,
  people,
  card,
  draft,
  setDraft,
  onPatch,
  onRun,
  onSubmitDraft,
  titleRef,
  layout = 'panel',
}: {
  ws: string
  board: Board
  cards: Card[]
  people: Person[]
  card?: Card
  draft?: Draft
  setDraft?: (fn: (d: Draft) => Draft) => void
  onPatch: (patch: CardPatch) => Promise<unknown>
  onRun?: () => Promise<unknown>
  /** Enter in the title of a draft. */
  onSubmitDraft?: () => void
  titleRef?: Ref<HTMLInputElement>
  layout?: 'panel' | 'page'
}) {
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity })
  const suggestions = useContextSuggestions(ws)
  const allLabels = useMemo(() => [...new Set(cards.flatMap((c) => c.labels))].sort(), [cards])
  const [propsOpen, setPropsOpen] = useState(true)

  const v: Draft = card
    ? {
        title: card.title,
        status: statusOf(board, card),
        assignee: card.assignee,
        due: card.due,
        labels: card.labels,
        description: card.description,
        runAt: card.runAt,
        context: card.context,
      }
    : (draft ?? emptyDraft(board))

  /** Local draft change, or a patch to the file (`server` when null must clear the field). */
  const set = (patch: Partial<Draft>, server?: CardPatch) => {
    if (card) void onPatch(server ?? (patch as CardPatch))
    else setDraft?.((d) => ({ ...d, ...patch }))
  }

  // Body edits are debounced; flushed when switching cards or leaving.
  const pending = useRef<string | null>(null)
  const saving = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const flush = async () => {
    clearTimeout(timer.current)
    if (pending.current !== null && card) {
      const description = pending.current
      pending.current = null
      saving.current++
      try {
        await onPatch({ description })
      } finally {
        saving.current--
      }
    }
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => void flushRef.current(), [card?.file])

  const isAi = v.assignee === 'ai'
  const ai = card?.ai
  const running = ai?.state === 'running'
  const fileName = card?.file ?? (v.title.trim() ? `${v.title.trim()}.md` : 'Untitled.md')
  const propCount = [v.status, v.assignee, v.due, v.labels.length, isAi && v.runAt, isAi && v.context.length].filter(
    Boolean,
  ).length
  // The editor is uncontrolled: it only reloads when the file really changed underneath us (the AI,
  // another editor) — never because of our own save echoing back (the server trims the body), never
  // while a save is in flight, and never while you're typing (applied when the editor loses focus).
  const [bodyKey, setBodyKey] = useState(0)
  const lastBody = useRef(v.description.trim())
  const editorRef = useRef<HTMLDivElement>(null)
  const stale = useRef(false)
  const reloadIfChanged = () => {
    if (!card || pending.current !== null || saving.current > 0) return
    if (card.description.trim() === lastBody.current) {
      stale.current = false
      return
    }
    if (editorRef.current?.contains(document.activeElement)) {
      stale.current = true
      return
    }
    stale.current = false
    lastBody.current = card.description.trim()
    setBodyKey((k) => k + 1)
  }
  const reloadRef = useRef(reloadIfChanged)
  reloadRef.current = reloadIfChanged
  useEffect(() => reloadRef.current(), [card])

  return (
    <div className={`doc card-doc ${layout === 'panel' ? 'in-panel' : 'as-page'} col g20`}>
      <div className="col g6">
        <TitleInput
          ref={titleRef}
          key={`${card?.file ?? 'new'}:${card?.title ?? ''}`}
          className="doc-title"
          defaultValue={v.title}
          placeholder="Untitled"
          aria-label="Title (file name)"
          onChange={card ? undefined : (e) => setDraft?.((d) => ({ ...d, title: e.target.value }))}
          onBlur={(e) => {
            const title = e.target.value.trim()
            if (card && title && title !== card.title) void onPatch({ title })
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (card) (e.target as HTMLInputElement).blur()
            else onSubmitDraft?.()
          }}
        />
        <span className="mono-s muted">
          {board.path}/{fileName}
        </span>
      </div>

      <section className="props" aria-label="Properties">
        <div className="props-h">
          <button
            type="button"
            className="mono row g8"
            aria-expanded={propsOpen}
            onClick={() => setPropsOpen((o) => !o)}
          >
            {propsOpen ? <IconChevDown /> : <IconChevRight />}
            Properties <span className="muted">· frontmatter · {propCount}</span>
          </button>
          {isAi && ai?.state && (
            <StatusBadge state={ai.state === 'done' ? 'ok' : ai.state === 'scheduled' ? 'scheduled' : ai.state} />
          )}
        </div>
        {propsOpen && (
          <div className="kv props-grid">
            <span className="k">status</span>
            <Select
              compact
              ariaLabel="status"
              value={v.status}
              options={board.columns.map((c) => ({ value: c.id, label: c.name, text: c.name }))}
              onChange={(status) => set({ status })}
            />
            <span className="k">assignee</span>
            <PersonSelect
              compact
              value={v.assignee}
              people={people}
              onChange={(id) => set({ assignee: id ?? undefined }, { assignee: id })}
            />
            <span className="k">due</span>
            <DatePicker
              compact
              ariaLabel="due"
              value={v.due}
              onChange={(due) => set({ due: due ?? undefined }, { due })}
            />
            <span className="k" style={{ alignSelf: 'start', paddingTop: 3 }}>
              labels
            </span>
            <TagInput
              ariaLabel="labels"
              values={v.labels}
              suggestions={allLabels}
              onChange={(labels) => set({ labels })}
            />
            {isAi && (
              <>
                <span className="k">run_at</span>
                <div className="row g6">
                  <div className="grow">
                    <DatePicker
                      compact
                      withTime
                      ariaLabel="run at"
                      placeholder="Pick a time…"
                      value={v.runAt}
                      onChange={(runAt) => set({ runAt: runAt ?? undefined }, { runAt })}
                    />
                  </div>
                  <span className="tz mono-s" title="The scheduler's timezone">
                    {config?.timezone ?? '—'}
                  </span>
                </div>
                <span className="k" style={{ alignSelf: 'start', paddingTop: 5 }}>
                  context
                </span>
                <TagInput
                  ariaLabel="context"
                  variant="tag"
                  addLabel="+ file or folder"
                  placeholder="notes/ or a file…"
                  values={v.context}
                  suggestions={suggestions}
                  onChange={(context) => set({ context })}
                />
              </>
            )}
          </div>
        )}
      </section>

      {isAi && card && (
        <section className="aibox ai-strip" aria-label="AI task">
          <div className="row g10 wrap">
            <span className="mono row g8">
              <IconSpark size={13} />
              AI task
            </span>
            <span className="small grow" style={{ opacity: 0.85 }}>
              {running
                ? 'Working on it now.'
                : v.runAt
                  ? `Runs ${formatDateValue(v.runAt, false)}. This page is the brief.`
                  : 'Set run_at, or run it now. This page is the brief.'}
            </span>
            <Button
              variant="primary"
              size="sm"
              busy={running}
              onClick={async () => {
                await flush()
                await onRun?.()
              }}
            >
              {running ? 'Running…' : '[▶] Run now'}
            </Button>
            {ai?.sessionId && (
              <ButtonLink size="sm" to={sessionUrl(ws, ai.sessionId)} className="btn-sage">
                {running ? 'Watch ↗' : 'Session ↗'}
              </ButtonLink>
            )}
          </div>
          {ai?.finishedAt && ai.summary && (
            <div className="col g6 ai-last">
              <span className="mono-s">Last run · {formatDateValue(ai.finishedAt.slice(0, 16), false)}</span>
              <p className="small" style={{ margin: 0 }}>
                “{ai.summary.trim()}”
              </p>
            </div>
          )}
        </section>
      )}

      <div
        ref={editorRef}
        onBlur={(e) => {
          if (stale.current && !e.currentTarget.contains(e.relatedTarget as Node)) reloadRef.current()
        }}
      >
        <Suspense fallback={<div className="skel" style={{ height: 160 }} />}>
          <MarkdownEditor
            key={`${card?.file ?? 'new'}:${bodyKey}`}
            value={v.description}
            onChange={(md) => {
              if (!card) {
                setDraft?.((d) => ({ ...d, description: md }))
                return
              }
              pending.current = md
              lastBody.current = md.trim()
              clearTimeout(timer.current)
              timer.current = window.setTimeout(() => void flush(), 700)
            }}
          />
        </Suspense>
      </div>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Type <span className="kbd">/</span> for blocks · this is the card’s file — changes save automatically
      </p>
    </div>
  )
}
