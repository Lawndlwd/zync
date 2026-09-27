import type { CalendarItem } from '../types/calendar'
import { hm, isDone } from './helpers'

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
      style={{ ...(color ? { '--c': color } : {}), ...style }}
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
