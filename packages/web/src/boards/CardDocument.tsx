import { useQuery } from '@tanstack/react-query'
import { Suspense, useMemo, useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { ButtonLink } from '../components/ButtonLink'
import { DatePicker } from '../components/DatePicker'
import { LazyMarkdownEditor } from '../components/LazyMarkdownEditor'
import { PersonSelect } from '../components/PersonSelect'
import { Select } from '../components/Select'
import { StatusBadge } from '../components/StatusBadge'
import { TagInput } from '../components/TagInput'
import { TitleInput } from '../components/TitleInput'
import { statusOf } from '../helpers/boards'
import { formatDateValue } from '../helpers/dates'
import { sessionUrl } from '../helpers/urls'
import { useContextSuggestions } from '../hooks/useContextSuggestions'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { useExternalReload } from '../hooks/useExternalReload'
import { IconChevDown, IconChevRight, IconSpark } from '../icons'
import type { Board, Card, CardPatch, Draft } from '../types/boards'
import type { Person } from '../types/people'
import { durationOptions, emptyDraft } from './helpers'

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
  layout?: 'panel' | 'page'
}) {
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity })
  const suggestions = useContextSuggestions(ws)
  const allLabels = useMemo(() => [...new Set(cards.flatMap((c) => c.labels))].toSorted(), [cards])
  const [propsOpen, setPropsOpen] = useState(true)

  const v: Draft = card
    ? {
        title: card.title,
        status: statusOf(board, card),
        assignee: card.assignee,
        due: card.due,
        duration: card.duration,
        labels: card.labels,
        description: card.description,
        runAt: card.runAt,
        context: card.context,
      }
    : (draft ?? emptyDraft(board))

  /** Local draft change, or a patch to the file (`server` when null must clear the field). */
  const set = (patch: Partial<Draft>, server?: CardPatch) => {
    if (card) void onPatch(server ?? patch)
    else setDraft?.((d) => ({ ...d, ...patch }))
  }

  // Body edits are debounced; each is saved to its own card, also after switching cards or leaving.
  const saver = useDebouncedSave<string>()
  const flush = saver.flush

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
  // Drafts never reload.
  const { version, box, edited, onBlur } = useExternalReload(v.description, () => !card || saver.busy())

  return (
    <div className={`doc card-doc ${layout === 'panel' ? 'in-panel' : 'as-page'} col g20`}>
      <div className="col g6">
        <TitleInput
          autoFocus={!card}
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
            if (card) e.currentTarget.blur()
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
              optionalTime
              ariaLabel="due"
              value={v.due}
              onChange={(due) => set({ due: due ?? undefined }, { due })}
            />
            {v.due?.includes('T') && (
              <>
                <span className="k">duration</span>
                <Select
                  compact
                  ariaLabel="duration"
                  value={String(v.duration ?? 60)}
                  options={durationOptions(v.duration)}
                  onChange={(d) => set({ duration: Number(d) }, { duration: Number(d) === 60 ? null : Number(d) })}
                />
              </>
            )}
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

      <div ref={box} onBlur={onBlur}>
        <Suspense fallback={<div className="skel" style={{ height: 160 }} />}>
          <LazyMarkdownEditor
            key={`${card?.file ?? 'new'}:${version}`}
            ws={ws}
            dir={board.path}
            value={v.description}
            onChange={(md) => {
              if (!card) {
                setDraft?.((d) => ({ ...d, description: md }))
                return
              }
              edited(md)
              saver.schedule(card.file, md, (description) => onPatch({ description }))
            }}
          />
        </Suspense>
      </div>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Type <span className="kbd">/</span> for blocks · <span className="kbd">@</span> to mention or link · this is the
        card’s file — changes save automatically
      </p>
    </div>
  )
}
