import { useRef, useState } from 'react'

import { dayLabel, ymd } from '../helpers/dates'
import type { CalendarItem, ViewProps } from '../types/calendar'
import { Block } from './Block'
import { dayAt, startDrag } from './drag'
import { colorOf, daysBetween, daysOf, lanes, shiftDays } from './helpers'

const LANE = 28

type Row = {
  id: string
  label: string
  items: CalendarItem[]
}

/**
 * Four weeks across, one row per kind of work: events, each board's cards, the AI's runs and jobs,
 * and what already ran. Drag a bar sideways to move it by days; drag an event's right edge to lengthen it.
 */
export function Timeline({ items, people, days, selectedId, onOpen, onChange, onCreate, onDay }: ViewProps) {
  const head = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; start: string; end: string } | null>(null)
  const keys = days.map(ymd)
  const today = ymd(new Date())
  const idx = (d: string) => daysBetween(keys[0] ?? d, d)

  const shown = items.map((i) => (drag?.id === i.id ? { ...i, start: drag.start, end: drag.end } : i))
  const boards = [
    ...new Set(
      shown
        .filter((i): i is CalendarItem & { board: string } => i.kind === 'card' && typeof i.board === 'string')
        .map((i) => i.board),
    ),
  ].toSorted()
  const rows: Row[] = [
    { id: 'events', label: 'Events', items: shown.filter((i) => i.kind === 'event') },
    ...boards.map((b) => ({
      id: `board:${b}`,
      label: b.split('/').pop() ?? b,
      items: shown.filter((i) => i.kind === 'card' && i.board === b),
    })),
    { id: 'ai', label: 'AI & jobs', items: shown.filter((i) => i.kind === 'card-ai' || i.kind === 'job') },
  ]
  const runs = shown.filter((i) => i.kind === 'run')

  const dragBar = (e: React.PointerEvent, item: CalendarItem, edge: 'move' | 'end') => {
    e.stopPropagation()
    const from = dayAt(head.current, e.clientX)?.day
    let delta = 0
    startDrag(e, {
      move: (x) => {
        const d = dayAt(head.current, x)?.day
        if (!from || !d || !item.editable) return
        delta = daysBetween(from, d)
        if (edge === 'move')
          setDrag({ id: item.id, start: shiftDays(item.start, delta), end: shiftDays(item.end, delta) })
        else {
          // Never before the start day.
          delta = Math.max(delta, daysBetween(item.end, item.start))
          setDrag({ id: item.id, start: item.start, end: shiftDays(item.end, delta) })
        }
      },
      end: (moved) => {
        setDrag(null)
        if (!moved) onOpen(item)
        else if (delta && edge === 'move') onChange(item, shiftDays(item.start, delta), shiftDays(item.end, delta))
        else if (delta) onChange(item, item.start, shiftDays(item.end, delta))
      },
    })
  }

  const cols = { gridTemplateColumns: `repeat(${days.length}, var(--tl-day))` }

  return (
    <div className="tl">
      <div className="tl-inner">
        <div className="tl-row tl-headrow">
          <span className="tl-label" />
          <div ref={head} className="tl-track" style={cols}>
            {days.map((d, i) => (
              <button
                key={keys[i]}
                type="button"
                data-day={keys[i]}
                className={`tl-day${keys[i] === today ? ' today' : ''}${d.getDay() === 1 ? ' monday' : ''}`}
                onClick={() => onDay(d)}
                title={dayLabel(d)}
              >
                <span className="mono-s">{dayLabel(d).slice(0, 1)}</span>
                <span>{d.getDate()}</span>
              </button>
            ))}
          </div>
        </div>

        {rows.map((row) => {
          const placed = lanes(
            row.items
              .map((item) => {
                const covered = daysOf(item)
                return {
                  item,
                  a: Math.max(0, idx(covered[0] ?? '')),
                  b: Math.min(days.length - 1, idx(covered.at(-1) ?? '')),
                }
              })
              .filter((p) => p.b >= 0 && p.a < days.length),
          )
          const height = Math.max(1, ...placed.map((p) => p.lane + 1)) * LANE + 8
          return (
            <div key={row.id} className="tl-row">
              <span className="tl-label mono trunc" title={row.label}>
                {row.label}
                <span className="muted"> · {row.items.length}</span>
              </span>
              <div className="tl-track tl-lanes" style={{ ...cols, height }}>
                {keys.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={`tl-cell${d === today ? ' today' : ''}${days[i]?.getDay() === 1 ? ' monday' : ''}`}
                    style={{ gridColumn: i + 1, gridRow: '1 / -1' }}
                    aria-label={`Add on ${d}`}
                    onDoubleClick={() => onCreate(d, d)}
                  />
                ))}
                {placed.map(({ item, a, b, lane }) => (
                  <Block
                    key={item.id}
                    item={item}
                    compact
                    className="tl-bar"
                    color={colorOf(item, people)}
                    selected={item.ref === selectedId}
                    dragging={drag?.id === item.id}
                    style={{ gridColumn: `${a + 1} / ${b + 2}`, top: lane * LANE + 4 }}
                    onPointerDown={(e) => dragBar(e, item, 'move')}
                    onActivate={() => onOpen(item)}
                    onResize={item.kind === 'event' && item.editable ? (e) => dragBar(e, item, 'end') : undefined}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <div className="tl-row">
          <span className="tl-label mono">
            Past runs<span className="muted"> · {runs.length}</span>
          </span>
          <div className="tl-track tl-runs" style={cols}>
            {keys.map((d, i) => {
              const day = runs.filter((r) => r.start.slice(0, 10) === d)
              return (
                <div
                  key={d}
                  className={`tl-cell${d === today ? ' today' : ''}${days[i]?.getDay() === 1 ? ' monday' : ''}`}
                >
                  {day.slice(0, 6).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`tl-run run-${r.status}`}
                      title={`${r.title} · ${r.start.slice(11, 16)} · ${r.status}`}
                      aria-label={`${r.title} ${r.status}`}
                      onClick={() => onOpen(r)}
                    />
                  ))}
                  {day.length > 6 && <span className="mono-s muted">+{day.length - 6}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
