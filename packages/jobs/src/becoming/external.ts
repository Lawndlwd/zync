import { z } from 'zod'

import { internalGet } from '../connections/client.js'
import type { Busy } from './types.js'

const Events = z.object({
  items: z.array(z.object({ title: z.string(), start: z.string(), end: z.string(), allDay: z.boolean() })),
})

/**
 * Timed events of the connected Google calendars between two days ("to" exclusive), read through
 * the api. None when connections aren't set up or the api can't be reached: evidence then comes
 * from zync's own calendar only.
 */
export async function externalBusy(from: string, to: string): Promise<Busy[]> {
  try {
    const r = Events.safeParse(await internalGet('/events', { from, to }))
    if (!r.success) return []
    return r.data.items.filter((e) => !e.allDay).map((e) => ({ title: e.title, start: e.start, end: e.end }))
  } catch {
    return []
  }
}
