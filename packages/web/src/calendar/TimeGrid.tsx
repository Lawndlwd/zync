import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CalendarItem } from '../api'
import { dayLabel, pad2 } from '../workspaceData'
import {
  atMinute,
  colorOf,
  DEFAULT_MINUTES,
  dayAt,
  dayOf,
  daysBetween,
  daysOf,
  hm,
  isDone,
  lanes,
  layoutDay,
  minuteOf,
  minutesBetween,
  resizable,
  SNAP,
  shiftDays,
  startDrag,
  type ViewProps,
  ymd,
} from './model'

const HOUR = 48
const PX_PER_MIN = HOUR / 60
const snap = (m: number) => Math.round(m / SNAP) * SNAP
const clampMin = (m: number) => Math.max(0, Math.min(24 * 60, m))

/** An item's start/end while it is being dragged, or the range being drawn for a new one. */
type Preview = { id: string; start: string; end: string } | null

/** Week and Day: an all-day row, then 24 hours with blocks you can move, stretch and draw. */
export function TimeGrid({ items, people, days, selectedId, onOpen, onChange, onCreate, onDay }: ViewProps) {
  const scroll = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const allDayRow = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<Preview>(null)
  const [now, setNow] = useState(() => new Date())
  const dayKeys = days.map(ymd)
  const today = ymd(now)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  // Open on the working day (or just before now when that's later).
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = Math.max(0, Math.min(7, now.getHours() - 2)) * HOUR
  }, [])

  const shown = (i: CalendarItem) => (preview?.id === i.id ? { ...i, start: preview.start, end: preview.end } : i)
  const all = items.map(shown)
  const allDay = all.filter((i) => i.allDay)
  const timed = all.filter((i) => !i.allDay)

  /** Pointer position → day and snapped minute inside the hour grid. */
  const at = (x: number, y: number) => {
    const hit = dayAt(body.current, x)
    return hit ? { day: hit.day, minute: clampMin((y - hit.rect.top) / PX_PER_MIN) } : null
  }

  const moveBlock = (e: React.PointerEvent, item: CalendarItem) => {
    e.stopPropagation()
    const grab = at(e.clientX, e.clientY)
    if (!grab || !item.editable) return startDrag(e, { move: () => {}, end: () => onOpen(item) })
    const offset = grab.minute - minuteOf(item.start)
    const length = minutesBetween(item.start, item.end)
    let next: Preview = null
    startDrag(e, {
      move: (x, y) => {
        const p = at(x, y)
        if (!p) return
        const startMin = clampMin(snap(p.minute - offset))
        const start = atMinute(p.day, Math.min(startMin, 24 * 60 - SNAP))
        next = { id: item.id, start, end: atMinute(p.day, Math.min(startMin, 24 * 60 - SNAP) + length) }
        setPreview(next)
      },
      end: (moved) => {
        setPreview(null)
        if (!moved) onOpen(item)
        else if (next) onChange(item, next.start, next.end)
      },
    })
  }

  const resizeBlock = (e: React.PointerEvent, item: CalendarItem) => {
    e.stopPropagation()
    const day = dayOf(item.start)
    let next: Preview = null
    startDrag(e, {
      move: (x, y) => {
        const p = at(x, y)
        if (!p) return
        const endMin = Math.max(minuteOf(item.start) + SNAP, snap(p.minute))
        next = { id: item.id, start: item.start, end: atMinute(day, endMin) }
        setPreview(next)
      },
      end: (moved) => {
        setPreview(null)
        if (moved && next) onChange(item, next.start, next.end)
      },
    })
  }

  const draw = (e: React.PointerEvent) => {
    const p = at(e.clientX, e.clientY)
    if (!p) return
    const startMin = Math.floor(p.minute / SNAP) * SNAP
    let next: Preview = {
      id: 'new',
      start: atMinute(p.day, startMin),
      end: atMinute(p.day, startMin + DEFAULT_MINUTES),
    }
    startDrag(e, {
      move: (x, y) => {
        const q = at(x, y)
        if (!q) return
        const endMin = Math.max(startMin + SNAP, Math.ceil(q.minute / SNAP) * SNAP)
        next = { id: 'new', start: atMinute(p.day, startMin), end: atMinute(p.day, endMin) }
        setPreview(next)
      },
      end: () => {
        setPreview(null)
        if (next) onCreate(next.start, next.end)
      },
    })
  }

  // ── all-day row: spanning bars stacked in lanes ──
  const idx = (d: string) => daysBetween(dayKeys[0], d)
  const bars = lanes(
    allDay
      .map((i) => {
        const covered = daysOf(i)
        return {
          item: i,
          a: Math.max(0, idx(covered[0])),
          b: Math.min(days.length - 1, idx(covered[covered.length - 1])),
        }
      })
      .filter((b) => b.b >= 0 && b.a < days.length),
  )
  const moveBar = (e: React.PointerEvent, item: CalendarItem) => {
    e.stopPropagation()
    const from = dayAt(allDayRow.current, e.clientX)?.day
    let delta = 0
    startDrag(e, {
      move: (x) => {
        const d = dayAt(allDayRow.current, x)?.day
        if (!from || !d || !item.editable) return
        delta = daysBetween(from, d)
        setPreview({ id: item.id, start: shiftDays(item.start, delta), end: shiftDays(item.end, delta) })
      },
      end: (moved) => {
        setPreview(null)
        if (!moved) onOpen(item)
        else if (delta) onChange(item, shiftDays(item.start, delta), shiftDays(item.end, delta))
      },
    })
  }

  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div className={`tg${days.length === 1 ? ' one' : ''}`}>
      <div className="tg-head">
        <span className="tg-gutter" />
        <div className="tg-cols" style={cols}>
          {days.map((d, i) => (
            <button
              key={dayKeys[i]}
              type="button"
              className={`tg-day${dayKeys[i] === today ? ' today' : ''}`}
              onClick={() => onDay(d)}
              title="Open this day"
            >
              <span className="mono-s">{dayLabel(d).slice(0, 3)}</span>
              <span className="tg-num">{d.getDate()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tg-allday">
        <span className="tg-gutter mono-s muted">All day</span>
        <div
          ref={allDayRow}
          className="tg-cols tg-bars"
          style={{ ...cols, gridTemplateRows: `repeat(${Math.max(1, ...bars.map((b) => b.lane + 1))}, 24px)` }}
        >
          {dayKeys.map((d, i) => (
            <button
              key={d}
              type="button"
              data-day={d}
              className="tg-allcell"
              style={{ gridColumn: i + 1, gridRow: '1 / -1' }}
              aria-label={`Add an all-day item on ${d}`}
              onClick={() => onCreate(d, d)}
            />
          ))}
          {bars.map(({ item, a, b, lane }) => (
            <Block
              key={item.id}
              item={item}
              color={colorOf(item, people)}
              selected={item.ref === selectedId}
              dragging={preview?.id === item.id}
              className="bar"
              style={{ gridColumn: `${a + 1} / ${b + 2}`, gridRow: lane + 1 }}
              onPointerDown={(e) => moveBar(e, item)}
              onActivate={() => onOpen(item)}
            />
          ))}
        </div>
      </div>

      <div ref={scroll} className="tg-scroll">
        <div className="tg-grid" style={{ height: 24 * HOUR }}>
          <div className="tg-gutter tg-hours" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="mono-s muted" style={{ top: h * HOUR }}>
                {h ? `${pad2(h)}:00` : ''}
              </span>
            ))}
          </div>
          <div ref={body} className="tg-cols tg-body" style={cols} onPointerDown={draw}>
            {dayKeys.map((d) => {
              const blocks = layoutDay(
                timed
                  .filter((i) => dayOf(i.start) === d)
                  .map((i) => {
                    const start = minuteOf(i.start)
                    const end = dayOf(i.end) === d ? Math.max(start + SNAP, minuteOf(i.end)) : 24 * 60
                    return { item: i, start, end }
                  }),
              )
              const ghost = preview?.id === 'new' && dayOf(preview.start) === d ? preview : null
              return (
                <div key={d} data-day={d} className={`tg-col${d === today ? ' today' : ''}`}>
                  {blocks.map(({ item, start, end, col, cols: n }) => (
                    <Block
                      key={item.id}
                      item={item}
                      color={colorOf(item, people)}
                      selected={item.ref === selectedId}
                      dragging={preview?.id === item.id}
                      style={{
                        top: start * PX_PER_MIN,
                        height: Math.max(18, (end - start) * PX_PER_MIN - 2),
                        left: `calc(${(col / n) * 100}% + 2px)`,
                        width: `calc(${100 / n}% - 4px)`,
                      }}
                      onPointerDown={(e) => moveBlock(e, item)}
                      onActivate={() => onOpen(item)}
                      onResize={resizable(item) ? (e) => resizeBlock(e, item) : undefined}
                    />
                  ))}
                  {ghost && (
                    <div
                      className="cal-block ghost"
                      style={{
                        top: minuteOf(ghost.start) * PX_PER_MIN,
                        height: minutesBetween(ghost.start, ghost.end) * PX_PER_MIN - 2,
                      }}
                    >
                      <span className="mono-s">
                        {hm(ghost.start)}–{hm(ghost.end)}
                      </span>
                    </div>
                  )}
                  {d === today && <div className="tg-now" style={{ top: nowMin * PX_PER_MIN }} aria-hidden="true" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const KIND_LABEL: Record<CalendarItem['kind'], string> = {
  event: 'Event',
  card: 'Card',
  'card-ai': 'AI run',
  job: 'Job',
  run: 'Run',
}

/** One item on the grid: a block (timed) or a bar (all-day). */
export function Block({
  item,
  color,
  selected,
  dragging,
  className = '',
  style,
  onPointerDown,
  onActivate,
  onResize,
  compact,
}: {
  item: CalendarItem
  color?: string
  selected?: boolean
  dragging?: boolean
  className?: string
  style?: React.CSSProperties
  onPointerDown: (e: React.PointerEvent) => void
  /** Enter / Space: open it. */
  onActivate: () => void
  onResize?: (e: React.PointerEvent) => void
  compact?: boolean
}) {
  const time = item.allDay ? '' : item.kind === 'run' ? hm(item.start) : `${hm(item.start)}–${hm(item.end)}`
  const tip = [
    item.title,
    KIND_LABEL[item.kind],
    time,
    item.recurring
      ? item.kind === 'event'
        ? 'repeats — open it to change the series'
        : 'recurring — change its schedule on the Jobs page'
      : '',
    item.kind === 'run' ? item.status : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div
      role="button"
      tabIndex={0}
      title={tip}
      className={`cal-block k-${item.kind}${item.editable ? ' editable' : ''}${selected ? ' sel' : ''}${dragging ? ' dragging' : ''}${isDone(item) ? ' done' : ''}${item.kind === 'run' ? ` run-${item.status}` : ''}${item.recurring ? ' recurring' : ''} ${className}`}
      style={{ ...(color ? { '--c': color } : {}), ...style } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
    >
      <span className="cal-block-t trunc">
        {compact && time && <span className="cal-block-m mono-s">{item.start.slice(11, 16)} </span>}
        {item.kind === 'card-ai' || item.kind === 'job' ? '✦ ' : ''}
        {item.kind === 'run' ? (item.status === 'ok' ? '✓ ' : item.status === 'skipped' ? '– ' : '✕ ') : ''}
        {item.title}
      </span>
      {!compact && time && <span className="cal-block-m mono-s">{time}</span>}
      {onResize && (
        <span
          className="cal-resize"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.stopPropagation()
            onResize(e)
          }}
        />
      )}
    </div>
  )
}
