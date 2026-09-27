import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useToast } from '../components/Dialog'
import { IconButton } from '../components/IconButton'
import { PersonAvatar } from '../components/PersonAvatar'
import { PillToggle } from '../components/PillToggle'
import { Segmented } from '../components/Segmented'
import { Select } from '../components/Select'
import { ymd } from '../helpers/dates'
import { isTyping } from '../helpers/dom'
import { errorMessage } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { useHotkeys } from '../hooks/useHotkeys'
import { usePeople } from '../hooks/usePeople'
import { IconChevRight } from '../icons'
import type { CardPatch } from '../types/boards'
import type { CalendarFilter, CalendarItem, Selection, View } from '../types/calendar'
import {
  DEFAULT_MINUTES,
  filterOf,
  minutesBetween,
  rangeLabel,
  rangeOf,
  selectionId,
  selectionKey,
  stepDate,
  toDate,
} from './helpers'
import { ItemPanel } from './ItemPanel'
import { MonthGrid } from './MonthGrid'
import { TimeGrid } from './TimeGrid'
import { Timeline } from './Timeline'

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'timeline', label: 'Timeline' },
]

const FILTERS: Array<{ value: CalendarFilter; label: string }> = [
  { value: 'events', label: 'Events' },
  { value: 'cards', label: 'Cards' },
  { value: 'ai', label: 'AI & jobs' },
  { value: 'runs', label: 'Past runs' },
]

/**
 * Everything with a time in one place: events (pages in Calendar/), cards (due + duration, AI run
 * times), scheduled jobs and past runs. Drag to move, drag an edge to resize, drag on empty space to
 * create. View, date and filters live in the URL so split panes and reloads keep them.
 */
export function CalendarView() {
  const { ws = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const people = usePeople()
  const [search, setSearch] = useSearchParams()
  const [selection, setSelection] = useState<Selection | null>(null)

  const viewParam = search.get('view')
  const view: View = VIEWS.find((v) => v.value === viewParam)?.value ?? 'week'
  const dateParam = search.get('date')
  const date = useMemo(
    () => (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? toDate(dateParam) : new Date()),
    [dateParam],
  )
  const hidden = new Set(
    (search.get('hide') ?? '')
      .split(',')
      .filter(Boolean)
      .filter((f): f is CalendarFilter => FILTERS.some((x) => x.value === f)),
  )
  const who = search.get('who') ?? ''

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
  const go = (v: View, d: Date) =>
    setParams({ view: v === 'week' ? null : v, date: ymd(d) === ymd(new Date()) ? null : ymd(d) })

  const { from, to, days } = rangeOf(view, date)
  const key = ['calendar', ws, ymd(from), ymd(to)]
  const { data, error, isLoading } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.calendar(ws, ymd(from), ymd(to), signal),
    placeholderData: (prev) => prev,
  })

  const items = (data ?? []).filter(
    (i) =>
      !hidden.has(filterOf(i)) &&
      (!who || i.assignee === who || i.people?.includes(who) || (who === 'ai' && filterOf(i) === 'ai')),
  )

  // Keyboard: ←/→ page, T today, M/W/D/L switch view.
  useHotkeys((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('.palette-wrap')) return
    const k = e.key.toLowerCase()
    const v = ({ m: 'month', w: 'week', d: 'day', l: 'timeline' } as const)[k]
    if (e.key === 'ArrowLeft') go(view, stepDate(view, date, -1))
    else if (e.key === 'ArrowRight') go(view, stepDate(view, date, 1))
    else if (k === 't') go(view, new Date())
    else if (v) go(v, date)
    else return
    e.preventDefault()
  })

  const refresh = (item?: CalendarItem) => {
    void qc.invalidateQueries({ queryKey: ['calendar', ws] })
    if (item?.board) void qc.invalidateQueries({ queryKey: ['board', ws, item.board] })
    if (item?.kind === 'job') void qc.invalidateQueries({ queryKey: ['jobs', ws] })
  }

  /** Move or resize: shown at once, written to the file, rolled back if the write fails. */
  const change = async (item: CalendarItem, start: string, end: string) => {
    if (start === item.start && end === item.end) return
    const allDay = start.length === 10
    const prev = qc.getQueryData<CalendarItem[]>(key)
    qc.setQueryData<CalendarItem[]>(key, (d) => d?.map((i) => (i.id === item.id ? { ...i, start, end, allDay } : i)))
    try {
      if (item.kind === 'event' && item.file) await api.updateEvent(ws, item.file, { start, end })
      else if (item.kind === 'card' && item.board && item.file) {
        const minutes = allDay ? null : minutesBetween(start, end)
        const patch: CardPatch = { due: start, duration: minutes === DEFAULT_MINUTES ? null : minutes }
        await api.updateCard(ws, item.board, item.file, patch)
      } else if (item.kind === 'card-ai' && item.board && item.file)
        await api.updateCard(ws, item.board, item.file, { runAt: start })
      else if (item.kind === 'job') await api.setJobAt(ws, item.ref, start)
      else return
    } catch (err) {
      qc.setQueryData(key, prev)
      toast(errorMessage(err), 'bad')
    }
    refresh(item)
  }

  const open = (item: CalendarItem) => {
    if (item.board && item.file) setSelection({ type: 'card', board: item.board, file: item.file })
    else if (item.kind === 'event' && item.file)
      setSelection({ type: 'event', file: item.file, date: item.recurring ? item.start.slice(0, 10) : undefined })
    else void navigate(wsUrl(ws, 'jobs'))
  }
  const create = (start: string, end: string) => setSelection({ type: 'new', start, end })

  const today = new Date()
  const shared = { items, people, onOpen: open, onChange: change, onCreate: create, selectedId: selectionId(selection) }

  return (
    <div className={`board-view cal-view${selection ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g16 cal-page">
          <div className="row between g16 wrap">
            <div className="row g16" style={{ alignItems: 'baseline', minWidth: 0 }}>
              <h1 className="display cal-title">{rangeLabel(view, date, days)}</h1>
              <span className="mono muted">
                {data ? `${items.filter((i) => i.kind !== 'run').length} items` : isLoading ? 'Loading…' : ''}
              </span>
            </div>
            <div className="row g8 wrap">
              <Segmented label="View" value={view} options={VIEWS} onChange={(v) => go(v, date)} />
              <span className="cal-sep" />
              <IconButton label="Previous (←)" onClick={() => go(view, stepDate(view, date, -1))}>
                <IconChevRight style={{ transform: 'rotate(180deg)' }} />
              </IconButton>
              <Button size="sm" onClick={() => go(view, today)} title="Today (T)">
                Today
              </Button>
              <IconButton label="Next (→)" onClick={() => go(view, stepDate(view, date, 1))}>
                <IconChevRight />
              </IconButton>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const d = view === 'day' || view === 'week' ? date : today
                  const start = `${ymd(d)}T${String(Math.min(22, today.getHours() + 1)).padStart(2, '0')}:00`
                  create(start, `${ymd(d)}T${String(Math.min(23, today.getHours() + 2)).padStart(2, '0')}:00`)
                }}
              >
                [+] New
              </Button>
            </div>
          </div>

          <div className="row between g12 wrap">
            <div className="row g6 wrap" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <PillToggle
                  key={f.value}
                  pressed={!hidden.has(f.value)}
                  onChange={(on) => {
                    const next = new Set(hidden)
                    if (on) next.delete(f.value)
                    else next.add(f.value)
                    setParams({ hide: [...next].join(',') || null })
                  }}
                >
                  <span className={`cal-dot k-${f.value}`} />
                  {f.label}
                </PillToggle>
              ))}
            </div>
            <div style={{ width: 200 }}>
              <Select
                compact
                ariaLabel="Person"
                value={who}
                onChange={(v) => setParams({ who: v || null })}
                options={[
                  { value: '', label: 'Everyone', text: 'everyone' },
                  ...people.map((p) => ({
                    value: p.id,
                    label: p.name,
                    text: `${p.name} ${p.id}`,
                    icon: <PersonAvatar id={p.id} people={people} />,
                  })),
                ]}
              />
            </div>
          </div>

          {error ? (
            <p className="lede danger-t">{error.message}</p>
          ) : view === 'month' ? (
            <MonthGrid {...shared} days={days} month={date.getMonth()} onDay={(d) => go('day', d)} />
          ) : view === 'timeline' ? (
            <Timeline {...shared} days={days} onDay={(d) => go('day', d)} />
          ) : (
            <TimeGrid {...shared} days={days} onDay={(d) => go('day', d)} />
          )}
          <p className="mono-s muted cal-hint">
            Drag to move · drag the bottom edge to resize · drag on empty space to add · ←/→ · T today · M W D L views
          </p>
        </div>
      </div>
      {selection && (
        <ItemPanel
          key={selectionKey(selection)}
          ws={ws}
          selection={selection}
          people={people}
          onSelect={setSelection}
          onChanged={() => refresh()}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  )
}
