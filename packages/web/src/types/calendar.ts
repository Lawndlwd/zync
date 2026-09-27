import type { Person } from './people'

type CalendarKind = 'event' | 'card' | 'card-ai' | 'job' | 'run'

export type CalendarItem = {
  id: string
  kind: CalendarKind
  title: string
  /** "YYYY-MM-DD" when all-day, else "YYYY-MM-DDTHH:MM". */
  start: string
  /** Inclusive last day when all-day, else the end time. */
  end: string
  allDay: boolean
  /** Workspace-relative file (events, cards) or job name (jobs, runs). */
  ref: string
  board?: string
  file?: string
  assignee?: string
  people?: string[]
  status?: string
  ai?: string
  recurring?: boolean
  editable: boolean
}

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export type Repeat = {
  every: 'day' | 'week' | 'month' | 'year'
  interval?: number
  days?: Weekday[]
  until?: string
  except?: string[]
}

export type CalendarEvent = {
  file: string
  title: string
  start: string
  end?: string
  people: string[]
  repeat?: Repeat
  description: string
}

export type EventPatch = Partial<{
  title: string
  start: string
  end: string | null
  people: string[]
  repeat: Repeat | null
  description: string
}>

export type View = 'month' | 'week' | 'day' | 'timeline'

/** What every calendar view gets from CalendarView. */
export type ViewProps = {
  items: CalendarItem[]
  people: Person[]
  days: Date[]
  /** `ref` of the item open in the side panel. */
  selectedId?: string
  onOpen: (item: CalendarItem) => void
  onChange: (item: CalendarItem, start: string, end: string) => void
  onCreate: (start: string, end: string) => void
  onDay: (d: Date) => void
}

export type Selection =
  /** `date`: the occurrence clicked, for a recurring event. */
  | { type: 'event'; file: string; date?: string }
  | { type: 'card'; board: string; file: string }
  | { type: 'new'; start: string; end: string }

export type PanelProps = {
  ws: string
  people: Person[]
  onSelect: (s: Selection) => void
  /** Something was written: refresh the calendar. */
  onChanged: () => void
  onClose: () => void
}

export type NewKind = 'event' | 'card'

/** An item's start/end while it is being dragged, or the range being drawn for a new one. */
export type Preview = { id: string; start: string; end: string } | null

export type CalendarFilter = 'events' | 'cards' | 'ai' | 'runs'

export type Every = Repeat['every']
