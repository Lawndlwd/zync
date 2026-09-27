import { useRef, useState } from 'react'
import type { CalendarItem } from '../api'
import { IconPlus } from '../icons'
import { colorOf, dayAt, daysBetween, daysOf, shiftDays, startDrag, type ViewProps, ymd } from './model'
import { Block } from './TimeGrid'

const MAX_CHIPS = 3
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Six weeks of days. Drag a chip to another day (it keeps its time); + or double-click adds. */
export function MonthGrid({
  items,
  people,
  days,
  month,
  selectedId,
  onOpen,
  onChange,
  onCreate,
  onDay,
}: ViewProps & { month: number }) {
  const grid = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; delta: number } | null>(null)
  const today = ymd(new Date())

  const byDay = new Map<string, CalendarItem[]>()
  const failed = new Map<string, number>()
  for (const raw of items) {
    const item =
      drag?.id === raw.id
        ? { ...raw, start: shiftDays(raw.start, drag.delta), end: shiftDays(raw.end, drag.delta) }
        : raw
    if (item.kind === 'run') {
      if (item.status === 'failed' || item.status === 'timeout')
        failed.set(item.start.slice(0, 10), (failed.get(item.start.slice(0, 10)) ?? 0) + 1)
      continue
    }
    for (const d of daysOf(item)) byDay.set(d, [...(byDay.get(d) ?? []), item])
  }

  const moveChip = (e: React.PointerEvent, item: CalendarItem) => {
    e.stopPropagation()
    const from = dayAt(grid.current, e.clientX, e.clientY)?.day
    let delta = 0
    startDrag(e, {
      move: (x, y) => {
        const d = dayAt(grid.current, x, y)?.day
        if (!from || !d || !item.editable) return
        delta = daysBetween(from, d)
        setDrag({ id: item.id, delta })
      },
      end: (moved) => {
        setDrag(null)
        if (!moved) onOpen(item)
        else if (delta) onChange(item, shiftDays(item.start, delta), shiftDays(item.end, delta))
      },
    })
  }

  return (
    <div className="mg">
      <div className="mg-head">
        {WEEKDAYS.map((w) => (
          <span key={w} className="mono-s muted">
            {w}
          </span>
        ))}
      </div>
      <div ref={grid} className="mg-grid">
        {days.map((d) => {
          const key = ymd(d)
          const list = (byDay.get(key) ?? []).sort(
            (a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
          )
          const more = list.length - MAX_CHIPS
          const fails = failed.get(key)
          return (
            <div
              key={key}
              data-day={key}
              className={`mg-cell${d.getMonth() !== month ? ' out' : ''}${key === today ? ' today' : ''}`}
              onDoubleClick={(e) => {
                if (e.target === e.currentTarget) onCreate(key, key)
              }}
            >
              <div className="row between mg-cell-h">
                <button type="button" className="mg-num" onClick={() => onDay(d)} title="Open this day">
                  {d.getDate()}
                </button>
                {fails ? (
                  <span className="mono-s danger-t" title={`${fails} failed run${fails === 1 ? '' : 's'}`}>
                    ✕{fails}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="mg-add"
                  aria-label={`Add on ${key}`}
                  onClick={() => onCreate(key, key)}
                >
                  <IconPlus />
                </button>
              </div>
              {list.slice(0, more > 0 ? MAX_CHIPS - 1 : MAX_CHIPS).map((item) => (
                <Block
                  key={item.id}
                  item={item}
                  compact
                  className="chip-block"
                  color={colorOf(item, people)}
                  selected={item.ref === selectedId}
                  dragging={drag?.id === item.id}
                  onPointerDown={(e) => moveChip(e, item)}
                  onActivate={() => onOpen(item)}
                />
              ))}
              {more > 0 && (
                <button type="button" className="mg-more mono-s" onClick={() => onDay(d)}>
                  +{more + 1} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
