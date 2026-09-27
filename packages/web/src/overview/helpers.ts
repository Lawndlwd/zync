import { runningCards, upcoming } from '../helpers/boards'
import { sameDay } from '../helpers/dates'
import type { Slot } from '../types/overview'
import type { WorkspaceData } from '../types/workspace'

export function todaySlots(data: WorkspaceData, now: Date): Slot[] {
  const past: Slot[] = data.runs
    .filter((r) => sameDay(r.time, now))
    .map((r) => ({ key: `r:${r.job}:${r.run.ts}`, time: r.time, kind: r.kind, title: r.title, state: r.run.status }))
    .toSorted((a, b) => a.time.getTime() - b.time.getTime())
    .slice(-3)
  const running: Slot[] = runningCards(data.cards).map((c) => ({
    key: `run:${c.ref}`,
    time: c.card.runAt ? new Date(c.card.runAt) : now,
    kind: 'card',
    title: c.card.title,
    state: 'running',
  }))
  const later: Slot[] = upcoming(data.jobs, data.cards, now)
    .filter((u) => sameDay(u.time, now))
    .slice(0, 6)
    .map((u, i) => ({
      key: `u:${u.job}:${u.time.getTime()}`,
      time: u.time,
      kind: u.kind,
      title: u.title,
      state: i ? 'planned' : 'next',
    }))
  return [...past, ...running, ...later]
}
