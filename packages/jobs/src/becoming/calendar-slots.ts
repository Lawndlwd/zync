import { addDays, daysApart } from '../helpers/dates.js'
import { dayMode } from './day-mode.js'
import { placeSlots, type Slot } from './slots.js'
import { listIdentities } from './store.js'
import { zyncBusy } from './today.js'
import type { Busy, Identity } from './types.js'

/** At most six weeks of slots per request (a month view with its spill-over days). */
const MAX_DAYS = 42

/** Where each identity lands, day by day over [from, to), each day heavy or open on its own. */
export async function becomingSlots(
  wsPath: string,
  from: string,
  to: string,
  external: Busy[] = [],
): Promise<{ identities: Identity[]; slots: Slot[] }> {
  const days = Math.min(Math.max(daysApart(from, to), 1), MAX_DAYS)
  const end = addDays(from, days)
  const [identities, own] = await Promise.all([listIdentities(wsPath), zyncBusy(wsPath, from, end)])
  const busy = [...own, ...external]
  const slots: Slot[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    slots.push(...placeSlots(identities, busy, date, dayMode(busy, date).mode === 'heavy'))
  }
  return { identities, slots }
}
