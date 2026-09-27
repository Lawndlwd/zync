import { Card } from '../components/Card'
import { upcoming } from '../helpers/boards'
import { addDays, pad2, startOfWeek } from '../helpers/dates'
import type { WorkspaceData } from '../types/workspace'
import { HeatRow } from './HeatRow'

const HOURS = [8, 10, 12, 14, 16, 18, 20]

export function Workload({ data, now }: { data: WorkspaceData; now: Date }) {
  const monday = startOfWeek(now)
  const end = addDays(monday, 7)
  const grid = HOURS.map(() => Array.from({ length: 7 }, () => 0))
  const add = (d: Date) => {
    if (d < monday || d >= end) return
    const h = d.getHours()
    if (h < 8 || h >= 22) return
    const row = grid[Math.floor((h - 8) / 2)]
    const col = (d.getDay() + 6) % 7
    if (row) row[col] = (row[col] ?? 0) + 1
  }
  for (const r of data.runs) add(r.time)
  for (const u of upcoming(data.jobs, data.cards, now)) add(u.time)
  for (const c of data.cards) if (c.card.due && c.card.due.length > 10) add(new Date(c.card.due))

  const todayCol = (now.getDay() + 6) % 7
  const nowRow = now.getHours() >= 8 && now.getHours() < 22 ? Math.floor((now.getHours() - 8) / 2) : -1
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <Card title="Workload" meta="AI runs + due cards · this week" className="c-heat">
      <div className="heat" role="img" aria-label="Workload heatmap by hour and weekday">
        <span />
        {names.map((n, i) => (
          <span key={n} className={`mono-s${i === todayCol ? '' : ' muted'}`} style={{ textAlign: 'center' }}>
            {n}
          </span>
        ))}
        {HOURS.map((h, r) => (
          <HeatRow key={h} label={pad2(h)} cells={grid[r] ?? []} now={r === nowRow ? todayCol : -1} />
        ))}
      </div>
      <div className="row g16 mono-s muted" style={{ marginTop: 14 }}>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-0)' }} />
          Free
        </span>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-1)' }} />
          Light
        </span>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-2)' }} />
          Busy
        </span>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-3)' }} />
          Full
        </span>
        <span className="row g6" style={{ marginLeft: 'auto' }}>
          <i className="sw" style={{ outline: '1.5px solid var(--ink)', outlineOffset: 1 }} />
          Now
        </span>
      </div>
    </Card>
  )
}
