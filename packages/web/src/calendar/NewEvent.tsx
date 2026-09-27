import { type ReactNode, useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { DatePicker } from '../components/DatePicker'
import { useToast } from '../components/Dialog'
import { TagInput } from '../components/TagInput'
import { TitleInput } from '../components/TitleInput'
import { errorMessage } from '../helpers/format'
import { usePanelEscape } from '../hooks/usePanelEscape'
import type { Repeat } from '../types/calendar'
import type { Person } from '../types/people'
import { addMinutes, CALENDAR_DIR, daysBetween, minutesBetween, shiftDays } from './helpers'
import { PanelShell } from './PanelShell'
import { describeRepeat } from './repeat'
import { RepeatField } from './RepeatField'

export function NewEvent({
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
  usePanelEscape(onClose)

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
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelShell
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
              autoFocus
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
    </PanelShell>
  )
}
