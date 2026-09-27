import type { PanelProps, Selection } from '../types/calendar'
import { CardSide } from './CardSide'
import { EventPanel } from './EventPanel'
import { NewPanel } from './NewPanel'

/** The calendar's side panel: an event's page, a card's page, or a new event / card. */
export function ItemPanel({ selection, ...rest }: PanelProps & { selection: Selection }) {
  if (selection.type === 'event') return <EventPanel {...rest} file={selection.file} date={selection.date} />
  if (selection.type === 'card') return <CardSide {...rest} board={selection.board} file={selection.file} />
  return <NewPanel {...rest} start={selection.start} end={selection.end} />
}
